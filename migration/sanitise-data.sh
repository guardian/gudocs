#!/bin/bash

INPUT=$1

cat "$INPUT" | sed 's/,"":""//g' | grep -v "^WRONGTYPE" | grep -v "^$"
