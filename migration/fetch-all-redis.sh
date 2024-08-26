#!/bin/bash

# Script to fetch all redis documents matching the prefix "gudocs:"

cursor=-1
keys=""

while [[ "$cursor" -ne 0 ]]; do
  if [[ "$cursor" -eq -1 ]]
  then
    cursor=0
  fi

  reply=$(redis-cli SCAN "$cursor" MATCH gudocs:*)
  cursor=$(echo "${reply}" | head -1)
  keys=$(echo "${reply}" | tail -n +2)
  if [ -n "$keys" ]; then
    while IFS= read -r line; do
      redis-cli get "$line"
    done <<< "$keys"
  fi
done
