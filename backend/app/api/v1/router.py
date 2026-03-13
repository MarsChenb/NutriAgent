from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.foods import router as foods_router
from app.api.v1.meals import router as meals_router
from app.api.v1.health import router as health_router
from app.api.v1.chat import router as chat_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(foods_router)
api_router.include_router(meals_router)
api_router.include_router(health_router)
api_router.include_router(chat_router)


@api_router.get("/ping")
async def ping():
    return {"message": "pong"}
