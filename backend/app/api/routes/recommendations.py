"""ค้นหาโรงแรมและสายการบินที่แนะนำ แยกตามภูมิภาคปลายทาง (ไม่ต้องเข้าสู่ระบบ)"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Airline, Hotel
from app.schemas import AirlineOut, Continent, HotelOut

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("/hotels", response_model=list[HotelOut])
def hotels(continent: Continent | None = None, q: str | None = None, db: Session = Depends(get_db)):
    stmt = select(Hotel).order_by(Hotel.country, Hotel.name)
    if continent:
        stmt = stmt.where(Hotel.continent == continent)
    if q:
        stmt = stmt.where(Hotel.name.ilike(f"%{q}%") | Hotel.city.ilike(f"%{q}%") | Hotel.country.ilike(f"%{q}%"))
    return db.scalars(stmt).all()


@router.get("/hotels/{hotel_id}", response_model=HotelOut)
def hotel(hotel_id: int, db: Session = Depends(get_db)):
    h = db.get(Hotel, hotel_id)
    if h is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ไม่พบข้อมูล")
    return h


@router.get("/airlines", response_model=list[AirlineOut])
def airlines(continent: Continent | None = None, q: str | None = None, db: Session = Depends(get_db)):
    stmt = select(Airline).order_by(Airline.name)
    if continent:
        stmt = stmt.where(Airline.continent == continent)
    if q:
        stmt = stmt.where(Airline.name.ilike(f"%{q}%") | Airline.code.ilike(f"%{q}%") | Airline.country.ilike(f"%{q}%"))
    return db.scalars(stmt).all()


@router.get("/airlines/{airline_id}", response_model=AirlineOut)
def airline(airline_id: int, db: Session = Depends(get_db)):
    a = db.get(Airline, airline_id)
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ไม่พบข้อมูล")
    return a
