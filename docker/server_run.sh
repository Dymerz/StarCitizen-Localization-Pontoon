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

echo ">>> Starting local server"
exec python manage.py runserver 0.0.0.0:8000
