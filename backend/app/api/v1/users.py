from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.dependencies import get_current_user
from app.models.user import User, UserProfile
from app.schemas.user import UserProfileResponse, UserProfileUpdate, UserResponse

router = APIRouter(prefix="/users", tags=["用户"])

ACTIVITY_FACTORS = {
    "sedentary": 1.2,
    "light": 1.375,
    "moderate": 1.55,
    "high": 1.725,
}

GOAL_ADJUSTMENTS = {
    "fat_loss": -450,
    "health": -250,
    "energy": -100,
    "detox": -150,
}


def compute_bmi(height_cm: float | None, weight_kg: float | None) -> float | None:
    if not height_cm or not weight_kg or height_cm <= 0:
        return None
    height_m = height_cm / 100
    return round(weight_kg / (height_m * height_m), 1)



def compute_weight_delta(current_weight_kg: float | None, target_weight_kg: float | None) -> float | None:
    if current_weight_kg is None or target_weight_kg is None:
        return None
    return round(current_weight_kg - target_weight_kg, 1)



def estimate_targets(
    gender: str | None,
    age: int | None,
    height_cm: float | None,
    current_weight_kg: float | None,
    activity_level: str | None,
    goal_type: str | None,
) -> tuple[int | None, float | None, float | None, float | None]:
    if not age or not height_cm or not current_weight_kg:
        return None, None, None, None

    if gender == "male":
        bmr = 10 * current_weight_kg + 6.25 * height_cm - 5 * age + 5
    else:
        bmr = 10 * current_weight_kg + 6.25 * height_cm - 5 * age - 161

    maintenance = bmr * ACTIVITY_FACTORS.get(activity_level or "sedentary", 1.2)
    calorie_target = max(1200, round(maintenance + GOAL_ADJUSTMENTS.get(goal_type or "fat_loss", -450)))
    protein_target = round(current_weight_kg * 1.6, 1)
    fat_target = round(current_weight_kg * 0.8, 1)
    carb_target = round(max(0, (calorie_target - protein_target * 4 - fat_target * 9) / 4), 1)
    return calorie_target, protein_target, fat_target, carb_target


async def ensure_profile(user: User, db: AsyncSession) -> UserProfile:
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = result.scalar_one_or_none()
    if not profile:
        profile = UserProfile(user_id=user.id, daily_calorie_target=2000, onboarding_completed=False)
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
    return profile



def build_profile_response(user: User, profile: UserProfile) -> UserProfileResponse:
    current_weight = float(profile.current_weight_kg) if profile.current_weight_kg is not None else None
    target_weight = float(profile.target_weight_kg) if profile.target_weight_kg is not None else None
    height_cm = float(user.height_cm) if user.height_cm is not None else None

    return UserProfileResponse(
        user_id=user.id,
        coach_persona=profile.coach_persona,
        goal_type=profile.goal_type,
        gender=user.gender,
        age=profile.age,
        height_cm=height_cm,
        current_weight_kg=current_weight,
        target_weight_kg=target_weight,
        body_shape=profile.body_shape,
        activity_level=profile.activity_level,
        medical_history=profile.medical_history,
        onboarding_completed=bool(profile.onboarding_completed),
        daily_calorie_target=profile.daily_calorie_target,
        protein_target_g=float(profile.protein_target_g) if profile.protein_target_g is not None else None,
        fat_target_g=float(profile.fat_target_g) if profile.fat_target_g is not None else None,
        carb_target_g=float(profile.carb_target_g) if profile.carb_target_g is not None else None,
        taste_preference=profile.taste_preference,
        allergies=profile.allergies,
        dietary_restrictions=profile.dietary_restrictions,
        bmi=compute_bmi(height_cm, current_weight),
        weight_delta_kg=compute_weight_delta(current_weight, target_weight),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return user


@router.get("/me/profile", response_model=UserProfileResponse)
async def get_my_profile(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await ensure_profile(user, db)
    return build_profile_response(user, profile)


@router.put("/me/profile", response_model=UserProfileResponse)
async def update_my_profile(
    data: UserProfileUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await ensure_profile(user, db)
    update_data = data.model_dump(exclude_unset=True)

    if "gender" in update_data:
        user.gender = update_data.pop("gender")
    if "height_cm" in update_data:
        user.height_cm = update_data.pop("height_cm")

    for key, value in update_data.items():
        setattr(profile, key, value)

    calorie_target, protein_target, fat_target, carb_target = estimate_targets(
        gender=user.gender,
        age=profile.age,
        height_cm=float(user.height_cm) if user.height_cm is not None else None,
        current_weight_kg=float(profile.current_weight_kg) if profile.current_weight_kg is not None else None,
        activity_level=profile.activity_level,
        goal_type=profile.goal_type,
    )

    if calorie_target is not None:
        profile.daily_calorie_target = calorie_target
        profile.protein_target_g = protein_target
        profile.fat_target_g = fat_target
        profile.carb_target_g = carb_target

    await db.commit()
    await db.refresh(user)
    await db.refresh(profile)
    return build_profile_response(user, profile)
