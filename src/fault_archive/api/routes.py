"""Compatibility import for the API router."""

from fault_archive.api_gateways.sse_endpoints import GenerateRequest, router

__all__ = ["GenerateRequest", "router"]
