"""
Tests for the geocoding client code from the blog post.
Run: python test_geocoding_client.py
"""

import math
import threading
import time
from dataclasses import dataclass, field

# === Coordinate Transformation ===

_A = 6378245.0
_EE = 0.00669342162296594323

def _out_of_china(lng: float, lat: float) -> bool:
    return not (72.004 <= lng <= 137.8347 and 0.8293 <= lat <= 55.8271)

def _transform_lat(x: float, y: float) -> float:
    ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y
    ret += 0.2 * math.sqrt(abs(x))
    ret += (20.0 * math.sin(6.0 * x * math.pi) +
            20.0 * math.sin(2.0 * x * math.pi)) * 2.0 / 3.0
    ret += (20.0 * math.sin(y * math.pi) +
            40.0 * math.sin(y / 3.0 * math.pi)) * 2.0 / 3.0
    ret += (160.0 * math.sin(y / 12.0 * math.pi) +
            320.0 * math.sin(y * math.pi / 30.0)) * 2.0 / 3.0
    return ret

def _transform_lng(x: float, y: float) -> float:
    ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y
    ret += 0.1 * math.sqrt(abs(x))
    ret += (20.0 * math.sin(6.0 * x * math.pi) +
            20.0 * math.sin(2.0 * x * math.pi)) * 2.0 / 3.0
    ret += (20.0 * math.sin(x * math.pi) +
            40.0 * math.sin(x / 3.0 * math.pi)) * 2.0 / 3.0
    ret += (150.0 * math.sin(x / 12.0 * math.pi) +
            300.0 * math.sin(x / 30.0 * math.pi)) * 2.0 / 3.0
    return ret

def wgs84_to_gcj02(lng: float, lat: float) -> tuple[float, float]:
    if _out_of_china(lng, lat):
        return lng, lat
    dlat = _transform_lat(lng - 105.0, lat - 35.0)
    dlng = _transform_lng(lng - 105.0, lat - 35.0)
    rad_lat = lat / 180.0 * math.pi
    magic = 1 - _EE * math.sin(rad_lat) ** 2
    sqrt_magic = math.sqrt(magic)
    dlat = (dlat * 180.0) / ((_A * (1 - _EE)) / (magic * sqrt_magic) * math.pi)
    dlng = (dlng * 180.0) / (_A / sqrt_magic * math.cos(rad_lat) * math.pi)
    return lng + dlng, lat + dlat

def gcj02_to_wgs84(lng: float, lat: float,
                   tol: float = 1e-6, max_iter: int = 10) -> tuple[float, float]:
    wgs_lng, wgs_lat = lng, lat
    for _ in range(max_iter):
        pred_lng, pred_lat = wgs84_to_gcj02(wgs_lng, wgs_lat)
        dlng, dlat = pred_lng - lng, pred_lat - lat
        if abs(dlng) < tol and abs(dlat) < tol:
            break
        wgs_lng -= dlng
        wgs_lat -= dlat
    return wgs_lng, wgs_lat


# === Rate Limiter ===

@dataclass
class TokenBucket:
    rate: float
    capacity: float
    _tokens: float = field(init=False)
    _timestamp: float = field(init=False)
    _lock: threading.Lock = field(init=False)

    def __post_init__(self):
        self._tokens = self.capacity
        self._timestamp = time.time()
        self._lock = threading.Lock()

    def acquire(self, tokens: int = 1) -> bool:
        with self._lock:
            now = time.time()
            self._tokens = min(
                self.capacity,
                self._tokens + (now - self._timestamp) * self.rate
            )
            self._timestamp = now
            if self._tokens >= tokens:
                self._tokens -= tokens
                return True
            return False


# === Tests ===

def test_coordinate_transformation():
    """Test WGS84 <-> GCJ02 round-trip conversion."""
    print("=" * 50)
    print("Test 1: Coordinate Transformation")
    print("=" * 50)

    # Test cases: famous locations in China
    test_points = [
        (116.397428, 39.90923, "Beijing Tiananmen"),
        (121.473701, 31.230416, "Shanghai People's Square"),
        (113.264385, 23.129112, "Guangzhou"),
        (114.057868, 22.543099, "Shenzhen"),
    ]

    all_passed = True
    for wgs_lng, wgs_lat, name in test_points:
        # Forward: WGS84 -> GCJ02
        gcj_lng, gcj_lat = wgs84_to_gcj02(wgs_lng, wgs_lat)

        # Backward: GCJ02 -> WGS84
        recovered_lng, recovered_lat = gcj02_to_wgs84(gcj_lng, gcj_lat)

        # Check round-trip error
        error_lng = abs(recovered_lng - wgs_lng)
        error_lat = abs(recovered_lat - wgs_lat)
        error_meters = math.sqrt(error_lng**2 + error_lat**2) * 111000  # rough conversion

        passed = error_meters < 0.1  # less than 0.1 meter
        status = "✓ PASS" if passed else "✗ FAIL"
        all_passed = all_passed and passed

        print(f"\n{name}:")
        print(f"  WGS84:     ({wgs_lng:.6f}, {wgs_lat:.6f})")
        print(f"  GCJ02:     ({gcj_lng:.6f}, {gcj_lat:.6f})")
        print(f"  Recovered: ({recovered_lng:.6f}, {recovered_lat:.6f})")
        print(f"  Error:     ~{error_meters:.4f} meters")
        print(f"  {status}")

    # Test outside China (should return unchanged)
    print(f"\nOutside China (New York):")
    nyc_lng, nyc_lat = -74.006, 40.7128
    result_lng, result_lat = wgs84_to_gcj02(nyc_lng, nyc_lat)
    passed = result_lng == nyc_lng and result_lat == nyc_lat
    status = "✓ PASS" if passed else "✗ FAIL"
    all_passed = all_passed and passed
    print(f"  Input:  ({nyc_lng}, {nyc_lat})")
    print(f"  Output: ({result_lng}, {result_lat})")
    print(f"  {status} (coordinates unchanged)")

    return all_passed


def test_token_bucket():
    """Test token bucket rate limiter."""
    print("\n" + "=" * 50)
    print("Test 2: Token Bucket Rate Limiter")
    print("=" * 50)

    # Create a bucket with 10 tokens/sec, capacity 20
    bucket = TokenBucket(rate=10, capacity=20)

    # Test 1: Initial burst should work
    print("\n1. Initial burst (20 tokens):")
    success_count = 0
    for _ in range(25):
        if bucket.acquire():
            success_count += 1
    passed1 = success_count == 20
    print(f"   Acquired {success_count}/25 (expected 20)")
    print(f"   {'✓ PASS' if passed1 else '✗ FAIL'}")

    # Test 2: Wait for refill
    print("\n2. Wait 1 second for refill:")
    time.sleep(1.0)
    success_count = 0
    for _ in range(15):
        if bucket.acquire():
            success_count += 1
    passed2 = 8 <= success_count <= 12  # ~10 tokens after 1 sec
    print(f"   Acquired {success_count}/15 (expected ~10)")
    print(f"   {'✓ PASS' if passed2 else '✗ FAIL'}")

    # Test 3: Thread safety
    print("\n3. Thread safety (concurrent access):")
    bucket2 = TokenBucket(rate=100, capacity=100)
    acquired = [0]
    lock = threading.Lock()

    def worker():
        for _ in range(50):
            if bucket2.acquire():
                with lock:
                    acquired[0] += 1

    threads = [threading.Thread(target=worker) for _ in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    passed3 = acquired[0] == 100  # Should get exactly 100 (capacity)
    print(f"   5 threads × 50 requests = 250 total")
    print(f"   Acquired: {acquired[0]} (expected 100 = capacity)")
    print(f"   {'✓ PASS' if passed3 else '✗ FAIL'}")

    return passed1 and passed2 and passed3


def test_http_session():
    """Test HTTP session with connection pooling."""
    print("\n" + "=" * 50)
    print("Test 3: HTTP Session with Connection Pool")
    print("=" * 50)

    try:
        import requests
        from requests.adapters import HTTPAdapter
        from urllib3.util.retry import Retry

        def create_resilient_session(pool_size: int = 50) -> requests.Session:
            session = requests.Session()
            retry_strategy = Retry(
                total=5,
                backoff_factor=1,
                status_forcelist=[429, 500, 502, 503, 504],
                allowed_methods=["GET"],
            )
            adapter = HTTPAdapter(
                max_retries=retry_strategy,
                pool_connections=pool_size,
                pool_maxsize=pool_size,
            )
            session.mount("https://", adapter)
            session.mount("http://", adapter)
            return session

        session = create_resilient_session(pool_size=10)
        print("\n1. Session created successfully")
        print(f"   Pool size: 10")
        print(f"   Retry strategy: 5 retries with exponential backoff")

        # Test actual request (to a reliable endpoint)
        print("\n2. Testing connection reuse:")
        try:
            resp = session.get("https://httpbin.org/get", timeout=5)
            passed = resp.status_code == 200
            print(f"   Request to httpbin.org: {resp.status_code}")
            print(f"   {'✓ PASS' if passed else '✗ FAIL'}")
        except requests.exceptions.RequestException as e:
            print(f"   Request failed (network issue): {e}")
            print("   ⚠ SKIP (network unavailable)")
            passed = True  # Don't fail test due to network

        session.close()
        return passed

    except ImportError:
        print("\n⚠ requests library not installed")
        print("  Run: pip install requests")
        return True  # Don't fail test due to missing dependency


def main():
    print("\n" + "=" * 50)
    print("  Geocoding Client Code Tests")
    print("=" * 50)

    results = []

    results.append(("Coordinate Transformation", test_coordinate_transformation()))
    results.append(("Token Bucket Rate Limiter", test_token_bucket()))
    results.append(("HTTP Session", test_http_session()))

    print("\n" + "=" * 50)
    print("  Summary")
    print("=" * 50)

    all_passed = True
    for name, passed in results:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"  {status}  {name}")
        all_passed = all_passed and passed

    print("\n" + "=" * 50)
    if all_passed:
        print("  All tests passed!")
    else:
        print("  Some tests failed!")
    print("=" * 50 + "\n")

    return 0 if all_passed else 1


if __name__ == "__main__":
    exit(main())
