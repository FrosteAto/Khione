#!/usr/bin/env bash
# Now-playing widgets for xfce4-genmon-plugin (needs playerctl).
#   nowplaying.sh                   ♫ | Artist – Title |  (short titles fit, long ones scroll)
#   nowplaying.sh prev|toggle|next  control buttons
#   nowplaying.sh click ARGS...     run playerctl ARGS and refresh (used by the buttons)
# A "frame" is one update of the title widget (genmon period 960 ms).

WIDTH=25                        # max box width in characters
SPEED=3                         # characters to scroll per frame
HOLD=3                          # frames to rest on the start of a title
GAP='     '                     # between the end of a scrolling title and its repeat
IDLE_TEXT='Nothing Playing'
BOX_FONT='JetBrains Mono'       # the box is drawn in BOX_FONT 10; classify() assumes it
NF='JetBrainsMono Nerd Font'
NOTE_COLOR='#8bb862' PIPE_COLOR='#39432f' BUTTON_COLOR='#a2ab96'   # Rei moss, overlay, subtext
ICON_NOTE=$'\U000F075A' ICON_PREV=$'\U000F04AE' ICON_NEXT=$'\U000F04AD'
ICON_PLAY=$'\U000F040A' ICON_PAUSE=$'\U000F03E4'
SEP=$'\x1f'
SELF=${BASH_SOURCE[0]}
RUN=${XDG_RUNTIME_DIR:-/tmp/nowplaying-$UID}
CACHE=$RUN/nowplaying.players BOX=$RUN/nowplaying.box FRAME=$RUN/nowplaying.frame
export LC_ALL=C.UTF-8
[ -d "$RUN" ] || mkdir -p "$RUN"
mode=${1:-text}

refresh_players() {
  local now=$(( ${EPOCHREALTIME/[.,]/} / 1000 ))
  mapfile -t lines < <(echo "$now"
    playerctl -a metadata --format "{{status}}$SEP{{playerInstance}}$SEP{{artist}}$SEP{{title}}" 2>/dev/null)
  printf '%s\n' "${lines[@]}" > "$CACHE.$$" && mv -f "$CACHE.$$" "$CACHE"
}

if [ "$mode" = click ]; then
  shift; playerctl "$@" >/dev/null 2>&1; sleep 0.2; refresh_players; exit
fi

# The buttons refresh the player list about once a second. The title widget only reads it,
# so it never waits on playerctl.
lines=()
[ -r "$CACHE" ] && mapfile -t lines < "$CACHE"
max_age=900; [ "$mode" = text ] && max_age=3000
[[ ${lines[0]} =~ ^[0-9]+$ ]] && (( ${EPOCHREALTIME/[.,]/} / 1000 - lines[0] <= max_age )) || refresh_players

status='' player='' artist='' title=''
for line in "${lines[@]:1}"; do
  s=${line%%"$SEP"*} r=${line#*"$SEP"}; p=${r%%"$SEP"*} r=${r#*"$SEP"}; a=${r%%"$SEP"*} t=${r#*"$SEP"}
  if [ "$s" = Playing ]; then
    status=$s player=$p artist=$a title=$t; break
  elif [ "$s" = Paused ] && [ -z "$player" ]; then
    status=$s player=$p artist=$a title=$t
  fi
done

if [ -z "$player" ]; then target='' alpha=45 button_alpha=45
else target="-p $player" button_alpha=100; [ "$status" = Playing ] && alpha=100 || alpha=60; fi

button() {  # icon, playerctl command, tooltip
  echo "<txt><span alpha='$button_alpha%' font_family='$NF' foreground='$BUTTON_COLOR'>$1</span></txt>"
  echo "<txtclick>$SELF click $target $2</txtclick>"
  echo "<tool>$3</tool>"
}

case $mode in
  prev)   button "$ICON_PREV" previous Previous; exit ;;
  next)   button "$ICON_NEXT" next Next; exit ;;
  toggle) if [ "$status" = Playing ]; then button "$ICON_PAUSE" pause Pause
          else button "$ICON_PLAY" play Play; fi; exit ;;
esac

# Every character has to land on JetBrains Mono's 8 px grid. Glyphs from fallback fonts
# don't, so they get padding: CJK 13+3 px (2 cells), Hangul 12+4, halfwidth kana 7+1,
# emoji 17+7 (3 cells). Sets W (cells) and P (padding px).
EMOJI_BMP=' 231A 231B 23E9 23EA 23EB 23EC 23F0 23F3 25FD 25FE 2614 2615 2648 2649 264A 264B 264C
  264D 264E 264F 2650 2651 2652 2653 267F 2693 26A1 26AA 26AB 26BD 26BE 26C4 26C5 26CE 26D4 26EA
  26F2 26F3 26F5 26FA 26FD 2705 270A 270B 2728 274C 274E 2753 2754 2755 2757 2795 2796 2797 27B0
  27BF 2B1B 2B1C 2B50 2B55 '   # symbols drawn as emoji by default
classify() {
  local c=$1; W=1 P=0
  if (( c < 0x1100 )); then return
  elif (( (c >= 0x1100 && c <= 0x11FF) || (c >= 0x3130 && c <= 0x318F) ||
          (c >= 0xAC00 && c <= 0xD7A3) )); then W=2 P=4
  elif (( c >= 0xFF61 && c <= 0xFF9F )); then W=1 P=1
  elif (( (c >= 0x2E80 && c <= 0x33FF) || (c >= 0x3400 && c <= 0x4DBF) ||
          (c >= 0x4E00 && c <= 0x9FFF) || (c >= 0xA000 && c <= 0xA4CF) ||
          (c >= 0xF900 && c <= 0xFAFF) || (c >= 0xFE30 && c <= 0xFE4F) ||
          (c >= 0xFF01 && c <= 0xFF60) || (c >= 0xFFE0 && c <= 0xFFE6) ||
          (c >= 0x20000 && c <= 0x3FFFD) )); then W=2 P=3
  elif (( c >= 0x1F000 && c <= 0x1FAFF )); then W=3 P=7
  elif (( c < 0x2B56 )); then
    printf -v hex '%04X' "$c"; [[ $EMOJI_BMP == *" $hex "* ]] && W=3 P=7
  fi
}

# Combining marks, variation selectors, skin tones etc. join the character before them.
is_mark() {
  local c=$1
  (( (c >= 0x300 && c <= 0x36F) || (c >= 0x200B && c <= 0x200F) || (c >= 0x20D0 && c <= 0x20FF) ||
     (c >= 0x2060 && c <= 0x2064) || (c >= 0xFE00 && c <= 0xFE0F) || (c >= 0x1F3FB && c <= 0x1F3FF) ||
     (c >= 0xE0020 && c <= 0xE007F) ))
}

# Split $1 into clusters CH (escaped text), CW (cells), CP (padding px), keeping emoji
# sequences (❤️, 👍🏽, flags, ZWJ families) whole.
split_chars() {
  local s=$1 i ch cp last join=0 flag=0
  for (( i = 0; i < ${#s}; i++ )); do
    ch=${s:i:1}
    printf -v cp '%d' "'$ch"
    case $ch in '&') ch='&amp;' ;; '<') ch='&lt;' ;; '>') ch='&gt;' ;; esac
    last=$(( ${#CH[@]} - 1 ))
    if (( last >= 0 )) && { (( join )) || is_mark "$cp" ||
                            (( flag && cp >= 0x1F1E6 && cp <= 0x1F1FF )); }; then
      CH[last]+=$ch
      (( cp == 0xFE0F )) && CW[last]=3 CP[last]=7   # emoji selector: ♥ becomes ❤️
      join=$(( cp == 0x200D )) flag=0
      continue
    fi
    classify "$cp"
    CH+=("$ch") CW+=("$W") CP+=("$P")
    join=0 flag=$(( cp >= 0x1F1E6 && cp <= 0x1F1FF ))
  done
}

# Normal-width text goes in an explicit BOX_FONT span, otherwise Pango draws spaces next to
# CJK text in the (narrower) CJK font.
put_plain() { (( in_run )) || { OUT+="<span font_family='$BOX_FONT'>"; in_run=1; }; OUT+=$1; }
put_other() { (( in_run )) && { OUT+='</span>'; in_run=0; }; OUT+=$1; }

draw_box() {  # clusters from index $1 on (wrapping) until WIDTH cells are filled
  local i used=0 c pad
  OUT='' in_run=0
  put_plain ' '
  for (( i = $1; i < $1 + n; i++ )); do
    c=$(( i % n ))
    (( used + CW[c] > WIDTH )) && break
    if (( CP[c] )); then put_other "${CH[c]}<span size='$(( CP[c] * 1280 ))'> </span>"  # 1280 = 1 px
    else put_plain "${CH[c]}"; fi
    (( used += CW[c] ))
  done
  (( total > WIDTH )) || used=$WIDTH   # short titles shrink the box to fit
  printf -v pad '%*s' $(( WIDTH - used + 1 )) ''; put_plain "$pad"
  (( in_run )) && OUT+='</span>'
}

# Splitting a title is the slow part, so it's done once per title and cached.
build_box() {
  local w
  CH=() CW=() CP=() total=0
  split_chars "$text"
  for w in "${CW[@]}"; do (( total += w )); done
  (( total > WIDTH )) && split_chars "$GAP"
  n=${#CH[@]} F0=$frame
  TIP=$(printf %s "$tip" | sed -z -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/\n/\&#10;/g')
  printf '%s\n' "$key" "$F0 $n $total" "$TIP" "${CH[@]}" "${CW[@]}" "${CP[@]}" > "$BOX.$$" && mv -f "$BOX.$$" "$BOX"
}

load_box() {
  local T; [ -r "$BOX" ] || return 1; mapfile -t T < "$BOX"
  [ "${T[0]}" = "$key" ] || return 1
  set -- ${T[1]}; F0=$1 n=$2 total=$3
  TIP=${T[2]} CH=("${T[@]:3:n}") CW=("${T[@]:3+n:n}") CP=("${T[@]:3+2*n:n}")
}

frame=0; [ -r "$FRAME" ] && read -r frame < "$FRAME"
echo $(( ++frame )) > "$FRAME"

if [ -n "$player" ]; then
  text=${artist:+$artist – }${title:-Unknown}
  tip="${title:-Unknown}"$'\n'"${artist:-Unknown artist}"$'\n'"${player%%.*}"
else
  text=$IDLE_TEXT tip='Nothing playing'
fi
key="$WIDTH$SEP$player$SEP$status$SEP$text"
load_box && (( frame >= F0 )) || build_box

offset=0
if (( total > WIDTH )) && [ "$status" = Playing ]; then
  t=$(( (frame - F0) % (HOLD + (n + SPEED - 1) / SPEED) ))
  (( t > HOLD )) && offset=$(( (t - HOLD) * SPEED ))
fi
draw_box "$offset"

printf "<txt><span alpha='%s%%'><span font_family='%s' foreground='%s'>%s</span> <span foreground='%s'>|</span><span font='%s 10'>%s</span><span foreground='%s'>|</span></span></txt>\n" \
  "$alpha" "$NF" "$NOTE_COLOR" "$ICON_NOTE" "$PIPE_COLOR" "$BOX_FONT" "$OUT" "$PIPE_COLOR"
printf '<tool>%s</tool>\n' "$TIP"
echo "<txtclick>$SELF click $target play-pause</txtclick>"
