"""Opaque server-side sessions, including short-lived pre-login CSRF challenges.

Revision ID: 6605a224ce01
Revises: 4521f61ba900
"""

import sqlalchemy as sa

from alembic import op

revision = "6605a224ce01"
down_revision = "4521f61ba900"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "auth_sessions",
        sa.Column("id_hash", sa.String(64), primary_key=True),
        sa.Column(
            "account_id", sa.Integer(), sa.ForeignKey("manager_accounts.id", ondelete="CASCADE")
        ),
        sa.Column("csrf_hash", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_auth_sessions_account_id", "auth_sessions", ["account_id"])
    op.create_index("ix_auth_sessions_expires_at", "auth_sessions", ["expires_at"])


def downgrade():
    op.drop_table("auth_sessions")
