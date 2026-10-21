"""Bit-exact signed Q1.15 multiplication reference."""


def q15_multiply(left: int, right: int) -> int:
    """Full 32-bit product, round nearest/ties away from zero, saturate to Q15.

    Integers encode real values divided by 32768. Python integers avoid any
    intermediate overflow; a C port must use int32_t for the full product.
    """
    for operand in (left, right):
        if not isinstance(operand, int):
            raise TypeError("Q15 operands must be integers")
        if not -32768 <= operand <= 32767:
            raise ValueError("Q15 operands must fit signed 16 bits")
    product = left * right
    magnitude = (abs(product) + 16384) // 32768
    rounded = -magnitude if product < 0 else magnitude
    return max(-32768, min(32767, rounded))
