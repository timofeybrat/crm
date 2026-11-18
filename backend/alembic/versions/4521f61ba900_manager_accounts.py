"""Manager credentials; no default passwords or public registration.

Revision ID: 4521f61ba900
Revises: 2f14aa091bc8
"""

import sqlalchemy as sa

from alembic import op

revision = "4521f61ba900"
down_revision = "2f14aa091bc8"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "manager_accounts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "manager_id", sa.Integer(), sa.ForeignKey("managers.id"), unique=True, nullable=False
        ),
        sa.Column("login", sa.String(64), unique=True, nullable=False),
        sa.Column("password_hash", sa.String(512), nullable=False),
        sa.Column("role", sa.String(16), nullable=False, server_default="manager"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint("role IN ('manager', 'admin')", name="role"),
    )


def downgrade():
    op.drop_table("manager_accounts")
