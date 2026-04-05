"""
fix_seo_links.py

Replaces all /?role=ROLENAME CTA links in your SEO HTML files
with onclick handlers that use sessionStorage instead.

This means Google will never see ?role= URLs again — it just
sees href="/" (your homepage), which is what you want.

HOW TO RUN:
1. Clone your GitHub repo locally (or run this inside it)
2. Put this script in the root of your project
3. Run: python fix_seo_links.py
4. Commit and push the updated files in public/interview/
"""

import os
import re

# Path to your SEO pages folder
SEO_FOLDER = os.path.join(os.path.dirname(__file__), "public", "interview")

def fix_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    original = content

    # Match any <a href="/?role=SOMETHING" ...> tag
    # Captures: the role value (URL-encoded), the class, and the link text
    pattern = re.compile(
        r'<a\s+href="\/\?role=([^"]+)"([^>]*)>(.*?)<\/a>',
        re.DOTALL
    )

    def replace_link(match):
        encoded_role = match.group(1)          # e.g. Affiliate+Marketing+Manager
        rest_of_attrs = match.group(2)         # e.g.  class="cta-btn"
        link_text = match.group(3)             # e.g. Start Free Practice Interview →

        # Decode the role name for sessionStorage (replace + with space)
        role_name = encoded_role.replace("+", " ")
        # Escape any single quotes in the role name
        role_name_safe = role_name.replace("'", "\\'")

        return (
            f'<a href="/" '
            f'onclick="sessionStorage.setItem(\'interviewRole\',\'{role_name_safe}\');"{rest_of_attrs}>'
            f'{link_text}</a>'
        )

    content = pattern.sub(replace_link, content)

    if content != original:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        return True
    return False


def main():
    if not os.path.isdir(SEO_FOLDER):
        print(f"ERROR: Could not find folder: {SEO_FOLDER}")
        print("Make sure you run this script from the root of your project.")
        return

    html_files = [f for f in os.listdir(SEO_FOLDER) if f.endswith(".html")]

    if not html_files:
        print(f"No HTML files found in {SEO_FOLDER}")
        return

    print(f"Found {len(html_files)} HTML files to process...\n")

    updated = 0
    skipped = 0

    for filename in html_files:
        filepath = os.path.join(SEO_FOLDER, filename)
        was_updated = fix_file(filepath)
        if was_updated:
            print(f"  ✓ Updated: {filename}")
            updated += 1
        else:
            skipped += 1

    print(f"\nDone! {updated} files updated, {skipped} files unchanged.")
    print("\nNext step: commit all changes and push to GitHub.")


if __name__ == "__main__":
    main()
