"""
Atlas V2 Backend – Authentication Utilities

Handles password hashing, JWT token creation/verification,
and FastAPI dependencies for protected routes.
"""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from config.settings import get_settings


# ── Password Hashing ──────────────────────────────────────────────────────────

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── JWT Tokens ────────────────────────────────────────────────────────────────

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


class TokenData(BaseModel):
    user_id: str
    email: str
    role: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT access token."""
    settings = get_settings()
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.jwt_access_token_expire_minutes)
    )
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    return jwt.encode(
        to_encode,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_token(token: str) -> Optional[TokenData]:
    """Decode and validate a JWT token. Returns None on failure."""
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        user_id = payload.get("sub")
        email = payload.get("email")
        role = payload.get("role", "operator")
        if user_id is None:
            return None
        return TokenData(user_id=user_id, email=email, role=role)
    except JWTError:
        return None


# ── FastAPI Dependencies ──────────────────────────────────────────────────────

async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)):
    """
    Dependency that extracts the current user from a JWT bearer token.
    Returns the User model from the database.
    """
    from storage.database import User, get_session, get_session_factory

    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_data = decode_token(token)
    if token_data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            select(User).where(User.user_id == token_data.user_id)
        )
        user = result.scalars().first()

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    return user


async def get_current_user_optional(token: Optional[str] = Depends(oauth2_scheme)):
    """
    Like get_current_user but returns None instead of raising
    for unauthenticated requests. Useful for endpoints that work
    both with and without auth.
    """
    if token is None:
        return None
    try:
        return await get_current_user(token)
    except HTTPException:
        return None


def require_role(*roles: str):
    """
    Dependency factory that ensures the current user has one of the
    specified roles. Usage: Depends(require_role("admin", "supervisor"))
    """
    async def role_checker(user=Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires one of these roles: {', '.join(roles)}",
            )
        return user
    return role_checker
