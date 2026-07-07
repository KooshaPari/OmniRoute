.PHONY: dev build test lint typecheck parity bench size clean

dev:
	pnpm dev

build:
	pnpm build

test:
	pnpm test

lint:
	pnpm lint

typecheck:
	pnpm -r typecheck

parity:
	pnpm parity

bench:
	pnpm bench

size:
	pnpm size

seed:
	pnpm seed

clean:
	pnpm clean
	rm -rf .data .svelte-kit target

deep-clean: clean
	rm -rf node_modules
