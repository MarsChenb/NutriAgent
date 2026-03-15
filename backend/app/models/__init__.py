from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


from app.models import exercise, food, knowledge, meal, memory, recipe, user  # noqa: E402,F401
