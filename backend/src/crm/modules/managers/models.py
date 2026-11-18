from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from crm.db.base import Base


class Manager(Base):
    __tablename__ = "managers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
