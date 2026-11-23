"""Initial schema for Antariksh Watch

Revision ID: 001_initial_schema
Revises:
Create Date: 2026-11-22 21:48:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "organizations",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("type", sa.Enum("GOV_AGENCY", "COMMERCIAL_ARM", "PRIVATE_STARTUP", name="organization_type_enum"), nullable=False),
        sa.Column("hq_city", sa.String(120), nullable=False),
        sa.Column("founded_year", sa.Integer(), nullable=False),
        sa.Column("focus_area", sa.String(120), nullable=False),
        sa.Column("in_space_authorized", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("website_url", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_organizations_name", "organizations", ["name"])
    op.create_index("ix_organizations_type", "organizations", ["type"])
    op.create_index("ix_organizations_focus_area", "organizations", ["focus_area"])

    op.create_table(
        "launch_vehicles",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("organization_id", sa.String(64), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("stages", sa.Integer(), nullable=False),
        sa.Column("leo_payload_kg", sa.Integer(), nullable=False),
        sa.Column("gto_payload_kg", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("propulsion_type", sa.String(255), nullable=False),
        sa.Column("status", sa.Enum("OPERATIONAL", "DEVELOPMENT", "RETIRED", name="vehicle_status_enum"), nullable=False),
    )
    op.create_index("ix_launch_vehicles_organization_id", "launch_vehicles", ["organization_id"])
    op.create_index("ix_launch_vehicles_status", "launch_vehicles", ["status"])

    op.create_table(
        "missions",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("organization_id", sa.String(64), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vehicle_id", sa.String(64), sa.ForeignKey("launch_vehicles.id", ondelete="SET NULL"), nullable=True),
        sa.Column("mission_code", sa.String(80), nullable=False, unique=True),
        sa.Column("title", sa.String(240), nullable=False),
        sa.Column("program", sa.String(100), nullable=False),
        sa.Column("launch_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("launch_site", sa.String(200), nullable=False),
        sa.Column("orbit_type", sa.String(160), nullable=False),
        sa.Column("status", sa.Enum("UPCOMING", "SUCCESS", "FAILURE", "IN_PROGRESS", name="mission_status_enum"), nullable=False),
        sa.Column("remarks", sa.Text(), nullable=False),
    )
    op.create_index("ix_missions_program_status", "missions", ["program", "status"])
    op.create_index("ix_missions_launch_date", "missions", ["launch_date"])

    op.create_table(
        "payloads",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("mission_id", sa.String(64), sa.ForeignKey("missions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("organization_id", sa.String(64), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("mass_kg", sa.Float(), nullable=False, server_default="0"),
        sa.Column("purpose", sa.Text(), nullable=False),
        sa.Column("country_of_origin", sa.String(100), nullable=False, server_default="India"),
    )
    op.create_index("ix_payloads_mission_id", "payloads", ["mission_id"])

    op.create_table(
        "isro_centres",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("acronym", sa.String(40), nullable=False, unique=True),
        sa.Column("city", sa.String(120), nullable=False),
        sa.Column("state", sa.String(120), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("primary_role", sa.Text(), nullable=False),
    )

    op.create_table(
        "sync_jobs",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("status", sa.Enum("QUEUED", "RUNNING", "COMPLETED", "FAILED", name="sync_job_status_enum"), nullable=False),
        sa.Column("source", sa.String(120), nullable=False),
        sa.Column("records_upserted", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("sync_jobs")
    op.drop_table("isro_centres")
    op.drop_table("payloads")
    op.drop_table("missions")
    op.drop_table("launch_vehicles")
    op.drop_table("organizations")
