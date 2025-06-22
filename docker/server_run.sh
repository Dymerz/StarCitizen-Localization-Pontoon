#!/bin/bash

# Prepares then runs the server

echo ">>> Setting up the db for Django"
python manage.py migrate

echo ">>> Initializing Pontoon"
echo "from pontoon.base.models import Locale;
def duplicate_locale(original_code, name):
  # Check if locale with the new name already exists
  if Locale.objects.filter(code=name).exists():
    return

  # Get the original locale and duplicate it
  original = Locale.objects.get(code=original_code)
  duplicate = Locale.objects.get(pk=original.pk)
  duplicate.code = name
  duplicate.save()

duplicate_locale('en', 'english');
duplicate_locale('fr', 'french_(france)');
duplicate_locale('de', 'german_(germany)');
duplicate_locale('it', 'italian_(italy)');
duplicate_locale('pt-BR', 'portuguese_(brazil)');
duplicate_locale('es-ES', 'spanish_(spain)');
" | python manage.py shell

# If we're in production mode, make sure static files are collected
if [ "$DJANGO_DEBUG" = "False" ]; then
  echo ">>> Setting up for production mode"
  echo ">>> Collecting static files"
  python manage.py collectstatic --noinput --clear

  # Make sure we're using the right settings
  export DJANGO_SETTINGS_MODULE=${DJANGO_SETTINGS_MODULE:-pontoon.settings}

  echo ">>> Starting Gunicorn server"
  exec gunicorn pontoon.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 120
else
  echo ">>> Starting local development server"
  exec python manage.py runserver 0.0.0.0:8000
fi
