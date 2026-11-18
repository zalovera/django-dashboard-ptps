import os
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


# =========================================================
# HELPER
# =========================================================

def csv_env(name, default=""):
    raw = os.getenv(name, default)
    return [
        item.strip()
        for item in raw.split(",")
        if item.strip()
    ]


def bool_env(name, default=False):
    val = os.getenv(name, str(default)).strip().lower()
    return val in {"1", "true", "yes", "on"}


# =========================================================
# ENVIRONMENT DETECTION
# =========================================================

IS_VERCEL = bool_env("VERCEL", False)

IS_PRODUCTION = (
    IS_VERCEL
    or bool_env("IS_PRODUCTION", False)
    or bool(os.getenv("RAILWAY_ENVIRONMENT"))
)


# =========================================================
# CORE SETTINGS
# =========================================================

SECRET_KEY = os.getenv("SECRET_KEY", "").strip()

if not SECRET_KEY:
    if IS_PRODUCTION:
        raise ValueError(
            "SECRET_KEY wajib diatur pada Environment Variables Vercel."
        )
    SECRET_KEY = "django-dev-key-change-this"

DEBUG = bool_env("DEBUG", not IS_PRODUCTION)

if IS_PRODUCTION and DEBUG:
    raise ValueError(
        "DEBUG harus False pada environment production."
    )


# =========================================================
# ALLOWED HOSTS
# =========================================================

ALLOWED_HOSTS = csv_env(
    "ALLOWED_HOSTS",
    "127.0.0.1,localhost"
)

if IS_PRODUCTION:
    if ".vercel.app" not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(".vercel.app")

    if "*" in ALLOWED_HOSTS:
        raise ValueError(
            "Wildcard '*' tidak diperbolehkan pada ALLOWED_HOSTS."
        )

vercel_url = os.getenv("VERCEL_URL", "").strip()
if vercel_url and vercel_url not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(vercel_url)

vercel_production_url = os.getenv(
    "VERCEL_PROJECT_PRODUCTION_URL", ""
).strip()
if vercel_production_url and vercel_production_url not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(vercel_production_url)


# =========================================================
# CSRF TRUSTED ORIGINS
# =========================================================

CSRF_TRUSTED_ORIGINS = csv_env(
    "CSRF_TRUSTED_ORIGINS",
    ""
)

if IS_PRODUCTION:
    if "https://*.vercel.app" not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append("https://*.vercel.app")

if vercel_url:
    origin = f"https://{vercel_url}"
    if origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(origin)

if vercel_production_url:
    origin = f"https://{vercel_production_url}"
    if origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(origin)


# =========================================================
# LOGIN / AUTH
# =========================================================

LOGIN_PIN = os.getenv("LOGIN_PIN", "").strip()

if not LOGIN_PIN:
    if IS_PRODUCTION:
        raise ValueError(
            "LOGIN_PIN wajib diatur pada Environment Variables Vercel."
        )
    LOGIN_PIN = "dev-pin-123"
    print("WARNING: Menggunakan LOGIN_PIN default development.")

LOGIN_URL = "/login/"
LOGIN_REDIRECT_URL = "/"
LOGOUT_REDIRECT_URL = "/login/"

# Session berlaku 7 hari
SESSION_COOKIE_AGE = 7 * 24 * 60 * 60

SESSION_COOKIE_SECURE = IS_PRODUCTION
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"

# Session di serverless: pakai cached_db supaya tidak query DB tiap request
SESSION_ENGINE = "django.contrib.sessions.backends.cached_db"

# Cache lokal per-lambda (bukan global, tapi mengurangi hit ke DB)
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "django-cache",
    }
}


# =========================================================
# APPS
# =========================================================

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "dashboard",
]


# =========================================================
# MIDDLEWARE
# =========================================================

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "dashboard.middleware.MaintenanceModeMiddleware",
    "dashboard.middleware_login.LoginRequiredMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]


# =========================================================
# URLS & TEMPLATES
# =========================================================

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


# =========================================================
# DATABASE — SUPABASE POSTGRESQL
# =========================================================
# Catatan penting untuk Vercel (serverless):
# - Gunakan connection pooler Supabase (port 6543, mode "transaction")
# - conn_max_age=0 karena lambda tidak persist koneksi
# - Set DISABLE_SERVER_SIDE_CURSORS=True (wajib untuk pgbouncer transaction mode)

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

if IS_PRODUCTION and not DATABASE_URL:
    raise ValueError(
        "DATABASE_URL wajib diatur pada Environment Variables Vercel."
    )

if DATABASE_URL:
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=0,
            conn_health_checks=True,
            ssl_require=True,
        )
    }

    DATABASES["default"].setdefault("OPTIONS", {})
    DATABASES["default"]["OPTIONS"]["sslmode"] = "require"

    # Wajib jika pakai Supabase pooler (transaction mode, port 6543)
    if ":6543" in DATABASE_URL:
        DATABASES["default"]["DISABLE_SERVER_SIDE_CURSORS"] = True

else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }


# =========================================================
# AUTH PASSWORD VALIDATORS
# =========================================================

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "UserAttributeSimilarityValidator"
        )
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "MinimumLengthValidator"
        )
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "CommonPasswordValidator"
        )
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "NumericPasswordValidator"
        )
    },
]


# =========================================================
# INTERNATIONALIZATION
# =========================================================

LANGUAGE_CODE = "id"
TIME_ZONE = "Asia/Jakarta"
USE_I18N = True
USE_TZ = True


# =========================================================
# STATIC FILES
# =========================================================

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]


# =========================================================
# MEDIA FILES
# =========================================================
# Vercel filesystem READ-ONLY → media tidak boleh disimpan lokal.
# Aktifkan USE_S3=True untuk pakai Supabase Storage / S3 / R2.

USE_S3 = bool_env("USE_S3", False)

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

if USE_S3:
    INSTALLED_APPS += ["storages"]

    AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")
    AWS_STORAGE_BUCKET_NAME = os.getenv("AWS_STORAGE_BUCKET_NAME", "")
    AWS_S3_ENDPOINT_URL = os.getenv("AWS_S3_ENDPOINT_URL", "")
    AWS_S3_REGION_NAME = os.getenv("AWS_S3_REGION_NAME", "")
    AWS_S3_CUSTOM_DOMAIN = os.getenv("AWS_S3_CUSTOM_DOMAIN", "")

    AWS_QUERYSTRING_AUTH = False
    AWS_DEFAULT_ACL = None
    AWS_S3_FILE_OVERWRITE = False

    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
        },
        "staticfiles": {
            "BACKEND": (
                "whitenoise.storage.CompressedManifestStaticFilesStorage"
                if not DEBUG
                else "django.contrib.staticfiles.storage.StaticFilesStorage"
            ),
        },
    }

    if AWS_S3_CUSTOM_DOMAIN:
        MEDIA_URL = f"https://{AWS_S3_CUSTOM_DOMAIN}/"

else:
    STORAGES = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage"
        },
        "staticfiles": {
            "BACKEND": (
                "whitenoise.storage.CompressedManifestStaticFilesStorage"
                if not DEBUG
                else "django.contrib.staticfiles.storage.StaticFilesStorage"
            ),
        },
    }


# =========================================================
# DEFAULT SETTINGS
# =========================================================

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# =========================================================
# UPLOAD LIMITS
# =========================================================
# Catatan: Vercel punya limit body request ~4.5 MB (hobby).
# Set MAX_UPLOAD_SIZE_MB <= 4 di Vercel untuk hindari 413.

DATA_UPLOAD_MAX_MEMORY_SIZE = 100 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 100 * 1024 * 1024
DATA_UPLOAD_MAX_NUMBER_FILES = 200
DATA_UPLOAD_MAX_NUMBER_FIELDS = 10000

MAX_UPLOAD_SIZE_MB = int(
    os.getenv("MAX_UPLOAD_SIZE_MB", "100")
)


# =========================================================
# SECURITY SETTINGS
# =========================================================

if IS_PRODUCTION:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = True

    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    CSRF_COOKIE_HTTPONLY = False

    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

    SESSION_COOKIE_SAMESITE = "Lax"
    CSRF_COOKIE_SAMESITE = "Lax"

SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "same-origin"


# =========================================================
# LOGGING
# =========================================================

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,

    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {message}",
            "style": "{",
        },
    },

    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },

    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },

    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": os.getenv("DJANGO_LOG_LEVEL", "INFO"),
            "propagate": False,
        },
        "django.db.backends": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
    },
}
