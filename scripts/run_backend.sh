#!/usr/bin/env bash

RUN=true

while getopts b flag; do
    case $flag in
        b) RUN=false ;; # Use -b to only build and not run
        *)
            echo "Invalid option"
            exit 1
            ;;
    esac
done

PROJECT_ROOT_DIR=$(realpath "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)/../")
BACKEND_DIR="$PROJECT_ROOT_DIR/src/backend"

cd "$BACKEND_DIR" || exit

echo "Building backend..."
cargo build --release
echo "Build completed."

if "$RUN"; then
    echo "Starting backend..."
    cargo run --release
    echo "Backend finished running."
fi

cd - >/dev/null || exit
