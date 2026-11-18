"""Video rooms and durable media cleanup queue.

Revision ID: 2f14aa091bc8
Revises: c16dbac65b8f
"""

import sqlalchemy as sa

from alembic import op

revision = "2f14aa091bc8"
down_revision = "c16dbac65b8f"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "video_rooms",
        sa.Column("meeting_id", sa.Integer(), sa.ForeignKey("meetings.id"), primary_key=True),
        sa.Column("room_name", sa.String(100), nullable=False, unique=True),
        sa.Column("invitation_hash", sa.String(64), unique=True),
        sa.Column("closed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_table(
        "video_cleanup",
        sa.Column("room_name", sa.String(100), primary_key=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )


def downgrade():
    op.drop_table("video_cleanup")
    op.drop_table("video_rooms")
