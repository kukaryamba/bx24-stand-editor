#!/bin/sh
# Забирает свежую сборку редактора стендов с GitHub и выкладывает её.
#
# Запускается на хостинге Таймвеб по расписанию (cron в панели управления).
# Хостинг не принимает SSH-подключения с серверов GitHub, поэтому не GitHub
# толкает файлы сюда, а хостинг сам забирает их из ветки deploy, куда GitHub
# кладёт готовую сборку после каждого пуша.
#
# Копия этого файла лежит на хостинге в ~/bin/stand-editor-pull.sh.
# Правите здесь — не забудьте обновить и там.

set -e

REPO="$HOME/stand-editor-deploy"
TARGET="$HOME/public_html/stand-editor/"
LOG="$HOME/stand-editor-deploy.log"
SOURCE="https://github.com/kukaryamba/bx24-stand-editor.git"

changed=""

if [ ! -d "$REPO/.git" ]; then
  git clone --quiet --depth 1 --branch deploy "$SOURCE" "$REPO"
  changed=1
else
  cd "$REPO"
  git fetch --quiet --depth 1 origin deploy
  # Выкладываем, только если в ветке появилось новое: скрипт запускается
  # часто, и без этой проверки гонял бы файлы впустую.
  if [ "$(git rev-parse HEAD)" != "$(git rev-parse FETCH_HEAD)" ]; then
    git reset --quiet --hard FETCH_HEAD
    changed=1
  fi
fi

[ -n "$changed" ] || exit 0

# --delete убирает то, чего больше нет в сборке. Папку со служебными файлами
# git не переносим — сайту она не нужна.
rsync -a --delete --exclude .git "$REPO/" "$TARGET"

echo "$(date '+%F %T') выложена $(git -C "$REPO" log -1 --format=%s)" >> "$LOG"
