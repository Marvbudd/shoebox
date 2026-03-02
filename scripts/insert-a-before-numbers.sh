#!/bin/bash
# Script to rename files from XXXXnnn.jpg to XXXXAnnn.jpg
# Inserts "A" between the letter prefix and numeric suffix

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter for renamed files
count=0
dry_run=false

# Check for --dry-run flag
if [[ "$1" == "--dry-run" ]]; then
    dry_run=true
    echo -e "${YELLOW}DRY RUN MODE - No files will be renamed${NC}"
    echo ""
fi

# Process all .jpg files in current directory
for file in *.jpg; do
    # Skip if no jpg files found
    if [[ "$file" == "*.jpg" ]]; then
        echo "No .jpg files found in current directory"
        exit 0
    fi
    
    # Extract the base name without extension
    basename="${file%.jpg}"
    
    # Check if filename matches pattern: letters followed by numbers
    # Pattern: one or more letters, then one or more digits
    if [[ "$basename" =~ ^([A-Za-z]+)([0-9]+)$ ]]; then
        prefix="${BASH_REMATCH[1]}"
        numbers="${BASH_REMATCH[2]}"
        
        # Create new filename with "A" inserted
        newfile="${prefix}A${numbers}.jpg"
        
        # Check if target file already exists
        if [[ -e "$newfile" ]]; then
            echo -e "${RED}Skip: $file -> $newfile (target exists)${NC}"
            continue
        fi
        
        if $dry_run; then
            echo -e "${YELLOW}Would rename: $file -> $newfile${NC}"
        else
            # Perform the rename
            mv "$file" "$newfile"
            echo -e "${GREEN}Renamed: $file -> $newfile${NC}"
        fi
        ((count++))
    fi
done

# Summary
echo ""
if $dry_run; then
    echo -e "${YELLOW}Dry run complete: $count file(s) would be renamed${NC}"
    echo "Run without --dry-run to perform actual renaming"
else
    echo -e "${GREEN}Complete: $count file(s) renamed${NC}"
fi
