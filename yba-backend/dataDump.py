"""Lambda entrypoint. The configured handler stays dataDump.lambda_handler."""

from ingest.dataDump import lambda_handler

if __name__ == "__main__":
    print(lambda_handler(None, None))
