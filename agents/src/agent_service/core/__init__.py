"""Infrastructure every agent package shares, and none of them own.

The test for belonging here is that two or more feature packages need it and
none can reasonably hold it. A single shared helper is not enough — that is how
the previous layout fragmented into 26 files.
"""
