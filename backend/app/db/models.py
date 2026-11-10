# backend/app/db/models.py

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, Float
from app.db.database import Base
# from db.database import Base

class Interaction(Base):
    __tablename__ = "interactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(50), index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    user_text = Column(Text)
    intent = Column(String(50))
    entities = Column(JSON, nullable=True)
    response_text = Column(Text)


class Room(Base):
    __tablename__ = "rooms"

    id = Column(String(100), primary_key=True)
    number = Column(String(20))
    name = Column(String(200))
    floor = Column(Integer)
    type = Column(String(50))
    department = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)
    keywords = Column(JSON, nullable=True)


class Person(Base):
    __tablename__ = "people"

    id = Column(Integer, primary_key=True, autoincrement=True)
    full_name = Column(String(200), nullable=False)
    role = Column(String(100))
    department = Column(String(200), nullable=True)
    room_id = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(100), nullable=True)
    keywords = Column(JSON, nullable=True)