#!/bin/bash
set -e

# Function to display usage
usage() {
  echo "Usage: $0 <version|major|minor|patch>"
  echo "Examples:"
  echo "  $0 1.2.0"
  echo "  $0 patch"
  exit 1
}

# Check if argument is provided
if [ -z "$1" ]; then
  usage
fi

INPUT_VERSION=$1

# Ensure git workspace is clean
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ Git workspace is not clean. Please commit or stash changes first."
  exit 1
fi

# Ensure we are on main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "⚠️  You are not on the main branch (current: $CURRENT_BRANCH)."
  read -p "Do you want to continue? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Update version in package.json
echo "🔄 Updating version in package.json..."
npm version $INPUT_VERSION --no-git-tag-version --allow-same-version

# Get the new version number
NEW_VERSION=$(node -p "require('./package.json').version")
echo "✅ New version: $NEW_VERSION"

# Bump versionCode and versionName in android/app/build.gradle
echo "🔄 Updating version in android/app/build.gradle..."
CURRENT_VERSION_CODE=$(grep -oP '(?<=versionCode )\d+' android/app/build.gradle)
NEW_VERSION_CODE=$((CURRENT_VERSION_CODE + 1))
sed -i '' "s/versionCode $CURRENT_VERSION_CODE/versionCode $NEW_VERSION_CODE/" android/app/build.gradle
sed -i '' "s/versionName \".*\"/versionName \"$NEW_VERSION\"/" android/app/build.gradle
echo "✅ versionCode: $CURRENT_VERSION_CODE → $NEW_VERSION_CODE, versionName: $NEW_VERSION"

# Commit and Tag
echo "📦 Committing and tagging..."
git add package.json android/app/build.gradle
git commit -m "chore(release): v$NEW_VERSION"
git tag "v$NEW_VERSION"
git push origin $CURRENT_BRANCH
git push origin "v$NEW_VERSION"

echo ""
echo "✅ Version bumped and tagged: v$NEW_VERSION"
echo "🚀 Release v$NEW_VERSION tagged and pushed."
echo "   GitHub Action 'Release APK' will now build and upload the APK."
