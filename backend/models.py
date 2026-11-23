import enum
from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class OrganizationType(str, enum.Enum):
    GOV_AGENCY = "GOV_AGENCY"
    COMMERCIAL_ARM = "COMMERCIAL_ARM"
    PRIVATE_STARTUP = "PRIVATE_STARTUP"


class VehicleStatus(str, enum.Enum):
    OPERATIONAL = "OPERATIONAL"
    DEVELOPMENT = "DEVELOPMENT"
    RETIRED = "RETIRED"


class MissionStatus(str, enum.Enum):
    UPCOMING = "UPCOMING"
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"
    IN_PROGRESS = "IN_PROGRESS"


class SyncJobStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    type: Mapped[OrganizationType] = mapped_column(
        Enum(OrganizationType, name="organization_type_enum"),
        nullable=False,
        index=True,
    )
    hq_city: Mapped[str] = mapped_column(String(120), nullable=False)
    founded_year: Mapped[int] = mapped_column(Integer, nullable=False)
    focus_area: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    in_space_authorized: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    website_url: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    vehicles: Mapped[List["LaunchVehicle"]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )
    missions: Mapped[List["Mission"]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )
    payloads: Mapped[List["Payload"]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )


class LaunchVehicle(Base):
    __tablename__ = "launch_vehicles"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    organization_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    stages: Mapped[int] = mapped_column(Integer, nullable=False)
    leo_payload_kg: Mapped[int] = mapped_column(Integer, nullable=False)
    gto_payload_kg: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    propulsion_type: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[VehicleStatus] = mapped_column(
        Enum(VehicleStatus, name="vehicle_status_enum"),
        nullable=False,
        index=True,
    )

    organization: Mapped["Organization"] = relationship(back_populates="vehicles")
    missions: Mapped[List["Mission"]] = relationship(back_populates="vehicle")


class Mission(Base):
    __tablename__ = "missions"
    __table_args__ = (
        Index("ix_missions_program_status", "program", "status"),
        Index("ix_missions_launch_date", "launch_date"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    organization_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    vehicle_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("launch_vehicles.id", ondelete="SET NULL"), nullable=True, index=True
    )
    mission_code: Mapped[str] = mapped_column(String(80), nullable=False, unique=True, index=True)
    title: Mapped[str] = mapped_column(String(240), nullable=False, index=True)
    program: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    launch_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    launch_site: Mapped[str] = mapped_column(String(200), nullable=False)
    orbit_type: Mapped[str] = mapped_column(String(160), nullable=False)
    status: Mapped[MissionStatus] = mapped_column(
        Enum(MissionStatus, name="mission_status_enum"),
        nullable=False,
        index=True,
    )
    remarks: Mapped[str] = mapped_column(Text, nullable=False)

    organization: Mapped["Organization"] = relationship(back_populates="missions")
    vehicle: Mapped[Optional["LaunchVehicle"]] = relationship(back_populates="missions")
    payloads: Mapped[List["Payload"]] = relationship(
        back_populates="mission", cascade="all, delete-orphan"
    )


class Payload(Base):
    __tablename__ = "payloads"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    mission_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("missions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    organization_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    mass_kg: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    purpose: Mapped[str] = mapped_column(Text, nullable=False)
    country_of_origin: Mapped[str] = mapped_column(String(100), nullable=False, default="India")

    mission: Mapped["Mission"] = relationship(back_populates="payloads")
    organization: Mapped["Organization"] = relationship(back_populates="payloads")


class IsroCentre(Base):
    __tablename__ = "isro_centres"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    acronym: Mapped[str] = mapped_column(String(40), nullable=False, unique=True, index=True)
    city: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    state: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    primary_role: Mapped[str] = mapped_column(Text, nullable=False)


class SyncJob(Base):
    __tablename__ = "sync_jobs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    status: Mapped[SyncJobStatus] = mapped_column(
        Enum(SyncJobStatus, name="sync_job_status_enum"),
        nullable=False,
        default=SyncJobStatus.QUEUED,
    )
    source: Mapped[str] = mapped_column(String(120), nullable=False, default="manual")
    records_upserted: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
