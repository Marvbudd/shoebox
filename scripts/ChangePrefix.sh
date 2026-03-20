#!/bin/bash
# Script to change the prefix of media files from one prefix to another
# Supports .jpg, .mp4, .mp3, and .mov files (case-insensitive)
# Usage: ./ChangePrefix.sh OLD_PREFIX NEW_PREFIX [--dry-run]
# Example: ./ChangePrefix.sh DSC_ BUDW --dry-run

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counter for renamed files
count=0
dry_run=false
old_prefix=""
new_prefix=""
old_prefix_set=false
new_prefix_set=false

# Function to display usage
show_usage() {
    echo -e "${BLUE}Usage:${NC} $0 OLD_PREFIX NEW_PREFIX [--dry-run]"
    echo ""
    echo "Supports: .jpg, .mp4, .mp3, .mov files (case-insensitive)"
    echo ""
    echo "Examples:"
    echo "  $0 DSC_ BUDW              # Rename DSC_1234.jpg to BUDW1234.jpg"
    echo "  $0 \"\" BUDW --dry-run       # Prepend BUDW to all media files"
    echo "  $0 IMG PHOTO --dry-run    # Preview: IMG001.JPG to PHOTO001.JPG"
    echo ""
    echo "Options:"
    echo "  --dry-run    Preview changes without renaming files"
    echo ""
    echo "Note: Use \"\" (empty string) as OLD_PREFIX to prepend to all filenames"
    echo ""
    exit 1
}

# Parse command line arguments
for arg in "$@"; do
    if [[ "$arg" == "--dry-run" ]]; then
        dry_run=true
    elif ! $old_prefix_set; then
        old_prefix="$arg"
        old_prefix_set=true
    elif ! $new_prefix_set; then
        new_prefix="$arg"
        new_prefix_set=true
    fi
done

# Check if both prefixes are provided
if ! $old_prefix_set || ! $new_prefix_set; then
    echo -e "${RED}Error: Both OLD_PREFIX and NEW_PREFIX are required${NC}"
    echo ""
    show_usage
fi

if $dry_run; then
    echo -e "${YELLOW}DRY RUN MODE - No files will be renamed${NC}"
fi
if [[ -z "$old_prefix" ]]; then
    echo -e "${BLUE}Prepending '${new_prefix}' to all filenames${NC}"
else
    echo -e "${BLUE}Changing prefix from '${old_prefix}' to '${new_prefix}'${NC}"
fi
echo ""

# Enable case-insensitive globbing
shopt -s nocaseglob

# Process all .jpg, .mp4, .mp3, and .mov files (case-insensitive) in current directory
found_files=false
for ext in jpg mp4 mp3 mov; do
    for file in *."$ext"; do
        # Skip if no files found for this extension
        if [[ ! -e "$file" ]]; then
            continue
        fi
        
        found_files=true
        
        # Extract the base name and extension separately
        basename="${file%.*}"
        extension="${file##*.}"
        
        # Check if filename starts with the old prefix
        if [[ "$basename" == "$old_prefix"* ]]; then
            # Remove the old prefix and add the new prefix
            suffix="${basename#$old_prefix}"
            newfile="${new_prefix}${suffix}.${extension}"
            
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
done

# Disable case-insensitive globbing
shopt -u nocaseglob

# Check if any files were found
if ! $found_files; then
    echo -e "${RED}No .jpg, .mp4, .mp3, or .mov files found in current directory${NC}"
    exit 0
fi

# Summary
echo ""
if $dry_run; then
    if [[ $count -eq 0 ]]; then
        if [[ -z "$old_prefix" ]]; then
            echo -e "${YELLOW}Dry run complete: No media files found to prepend '${new_prefix}' to${NC}"
        else
            echo -e "${YELLOW}Dry run complete: No files match prefix '${old_prefix}'${NC}"
        fi
    else
        echo -e "${YELLOW}Dry run complete: $count file(s) would be renamed${NC}"
        echo "Run without --dry-run to perform actual renaming"
    fi
else
    if [[ $count -eq 0 ]]; then
        if [[ -z "$old_prefix" ]]; then
            echo -e "${YELLOW}Complete: No media files found to prepend '${new_prefix}' to${NC}"
        else
            echo -e "${YELLOW}Complete: No files with prefix '${old_prefix}' were found${NC}"
        fi
    else
        echo -e "${GREEN}Complete: $count file(s) renamed${NC}"
    fi
fi
