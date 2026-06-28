FROM python:3.12-slim

RUN pip install --no-cache-dir pre-commit==3.8.0

COPY <<"EOF" /usr/local/bin/pre-commit-wrapper
#!/bin/sh
exec pre-commit run --all-files --config .pre-commit-config.yaml "$@"
EOF

RUN chmod +x /usr/local/bin/pre-commit-wrapper

WORKDIR /workspace
ENTRYPOINT ["pre-commit"]
CMD ["run", "--all-files", "--config", ".pre-commit-config.yaml"]
