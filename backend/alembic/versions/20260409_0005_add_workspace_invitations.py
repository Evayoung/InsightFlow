"""add workspace invitations

Revision ID: 20260409_0005
Revises: 20260227_0004
Create Date: 2026-04-09 10:30:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260409_0005"
down_revision: Union[str, None] = "20260227_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "workspace_invitations",
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column(
            "role",
            postgresql.ENUM("owner", "admin", "editor", "viewer", name="workspacerole", create_type=False),
            nullable=False,
        ),
        sa.Column("invited_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["invited_by_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("workspace_id", "email", name="uq_workspace_invitation_workspace_email"),
    )
    op.create_index("ix_workspace_invitations_email", "workspace_invitations", ["email"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_workspace_invitations_email", table_name="workspace_invitations")
    op.drop_table("workspace_invitations")
