shopt -s nullglob
for file in images/*.{jpg,png}; do
	if [ -f "$file" ] && [ ! -f "tn/$file" ]; then
		mkdir -p "tn/$(dirname "$file")"
		magick "$file" -resize '320x320>' -quality 90 "tn/$file"
	fi
done

