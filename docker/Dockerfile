FROM python:3.11-bookworm AS server

ARG USER_ID=1000
ARG GROUP_ID=1000

ENV DEBIAN_FRONTEND=noninteractive
ENV HGPYTHON3=1

# Python environment variables
ENV PYTHONUNBUFFERED 1
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONPATH /app

# Install required software.
RUN apt-get update \
  # Enable downloading packages over https
  && apt-get install -y apt-transport-https \
  # Add source for node.js
  && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
  && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_18.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
  # Install software
  && apt-get update \
  && apt-get install -y --no-install-recommends \
  build-essential \
  libmemcached-dev \
  nodejs \
  postgresql-client \
  postgresql-server-dev-15 \
  # Clean up what can be cleaned up.
  && apt-get autoremove -y

# Install uv (version should match the one used in Python GitHub workflows)
COPY --from=ghcr.io/astral-sh/uv:0.5.31 /uv /bin/uv

WORKDIR /app

# Install Pontoon Python requirements
COPY requirements/* /app/requirements/
RUN uv pip install --system -r requirements/default.txt -r requirements/dev.txt -r requirements/test.txt -r requirements/lint.txt

# Create the app user
RUN groupadd -r --gid=${GROUP_ID} pontoon && useradd --uid=${USER_ID} --no-log-init -r -m -g pontoon pontoon
RUN chown -R pontoon:pontoon /app
USER pontoon

# Set up Node.js environment variables
ENV YUGLIFY_BINARY /app/node_modules/.bin/yuglify
ENV TERSER_BINARY /app/node_modules/.bin/terser
ENV PATH /app/node_modules/.bin:$PATH

# First copy only package.json files to leverage Docker caching
COPY --chown=pontoon:pontoon package.json .
COPY --chown=pontoon:pontoon pontoon/package.json ./pontoon/
COPY --chown=pontoon:pontoon translate/package.json ./translate/
COPY --chown=pontoon:pontoon ./docker/config/server.env .env

# Install all dependencies including dev dependencies with legacy peer deps to avoid conflicts
RUN npm install --include=dev --legacy-peer-deps

# Now copy the rest of the files
COPY --chown=pontoon:pontoon . /app/

# Install any missing workspace dependencies with legacy peer deps
RUN npm install --include=dev --workspaces --if-present --legacy-peer-deps

# Build the project
RUN npm run build:prod
RUN python manage.py collectstatic

STOPSIGNAL SIGINT
CMD ["/app/docker/server_run.sh"]
