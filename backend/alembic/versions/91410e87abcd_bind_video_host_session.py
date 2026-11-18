"""Bind video host access to a revocable CRM session.

Revision ID: 91410e87abcd
Revises: 7bd9f5482d10
"""

import sqlalchemy as sa

from alembic import op

revision = "91410e87abcd"
down_revision = "7bd9f5482d10"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("video_rooms", sa.Column("host_session_hash", sa.String(64)))
    # Rooms created before session authentication must be explicitly recreated.
    op.execute(
        "INSERT INTO video_cleanup (room_name) "
        "SELECT room_name FROM video_rooms ON CONFLICT DO NOTHING"
    )
    op.execute("DELETE FROM video_rooms")


def downgrade():
    op.drop_column("video_rooms", "host_session_hash")
