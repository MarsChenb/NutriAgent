from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.models.user import User, UserProfile

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

DEFAULT_USER_USERNAME = "local_user"
DEFAULT_USER_NICKNAME = "NutriAgent User"
DEFAULT_USER_PASSWORD = "nutriagent-local-user"
DEFAULT_DAILY_CALORIE_TARGET = 2000


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


async def ensure_default_user(db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.username == DEFAULT_USER_USERNAME))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(
            username=DEFAULT_USER_USERNAME,
            nickname=DEFAULT_USER_NICKNAME,
            hashed_password=hash_password(DEFAULT_USER_PASSWORD),
        )
        db.add(user)
        await db.flush()

    profile_result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = profile_result.scalar_one_or_none()
    if profile is None:
        profile = UserProfile(
            user_id=user.id,
            daily_calorie_target=DEFAULT_DAILY_CALORIE_TARGET,
        )
        db.add(profile)

    await db.commit()
    await db.refresh(user)
    return user


async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not token:
        return await ensure_default_user(db)

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无效的认证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id = int(payload.get("sub", 0))
        if not user_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user
