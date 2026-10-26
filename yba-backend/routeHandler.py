"""Lambda entrypoint. The configured handler stays routeHandler.lambda_handler."""

from query.routeHandler import lambda_handler

__all__ = ["lambda_handler"]
