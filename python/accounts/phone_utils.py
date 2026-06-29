import re


def digits_only(phone: str) -> str:
    return re.sub(r"\D", "", phone or "")


def normalize_phone(phone: str) -> str:
    """E.164-style storage: +233XXXXXXXXX"""
    digits = digits_only(phone)
    if digits.startswith("233"):
        return f"+{digits}"
    if digits.startswith("0") and len(digits) == 10:
        return f"+233{digits[1:]}"
    if len(digits) == 9:
        return f"+233{digits}"
    if phone.strip().startswith("+"):
        return phone.strip()
    return phone.strip()


def arkesel_recipient(phone: str) -> str:
    """Arkesel expects 233XXXXXXXXX (no leading +)."""
    digits = digits_only(normalize_phone(phone))
    if digits.startswith("233"):
        return digits
    if digits.startswith("0") and len(digits) == 10:
        return "233" + digits[1:]
    if len(digits) == 9:
        return "233" + digits
    return digits


def is_valid_ghana_phone(phone: str) -> bool:
    digits = digits_only(phone)
    if phone.strip().startswith("+233"):
        return len(digits) == 12
    if digits.startswith("233"):
        return len(digits) == 12
    if digits.startswith("0"):
        return len(digits) == 10
    return len(digits) == 9 and digits[0] in "23456789"
