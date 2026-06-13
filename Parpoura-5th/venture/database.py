"""Venture Platform - Database Configuration

PostgreSQL async connection using SQLAlchemy 2.0.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from venture.ledger.schema import Base

# Database URL - configure via DATABASE_URL env var
DATABASE_URL = "postgresql+asyncpg://localhost:5432/venture"


class DatabaseConfig:
    """Database configuration and session management."""

    def __init__(self, database_url: str = DATABASE_URL):
        self.database_url = database_url
        self.engine = create_async_engine(
            database_url,
            echo=False,
            pool_size=10,
            max_overflow=20,
        )
        self.session_factory = async_sessionmaker(
            self.engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )

    async def init_db(self) -> None:
        """Initialize database tables."""
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def close(self) -> None:
        """Close database connections."""
        await self.engine.dispose()

    @asynccontextmanager
    async def session(self) -> AsyncGenerator[AsyncSession, None]:
        """Get a database session."""
        async with self.session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise


# Global database config instance
db_config: DatabaseConfig | None = None


def get_db_config() -> DatabaseConfig:
    """Get the global database config."""
    global db_config
    if db_config is None:
        db_config = DatabaseConfig()
    return db_config
