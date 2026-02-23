.PHONY: up down test lint cleanup

up:
	docker compose -f infra/docker-compose.yml up --build -d

down:
	docker compose -f infra/docker-compose.yml down

test:
	pytest -q

cleanup:
	python -m scripts.cleanup_expired
