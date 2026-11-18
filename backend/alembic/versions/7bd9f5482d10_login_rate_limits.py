"""Shared atomic authentication rate limits.

Revision ID: 7bd9f5482d10
Revises: 6605a224ce01
"""

import sqlalchemy as sa

from alembic import op

revision = "7bd9f5482d10"
down_revision = "6605a224ce01"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "auth_rate_buckets",
        sa.Column("id_hash", sa.String(64), primary_key=True),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_auth_rate_buckets_expires_at", "auth_rate_buckets", ["expires_at"])


def downgrade():
    op.drop_table("auth_rate_buckets")
