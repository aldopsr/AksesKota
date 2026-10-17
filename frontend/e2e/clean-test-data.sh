#!/bin/bash
su postgres -c "psql -q -d akseskota -c \"truncate reports, reviews, contributions, facility_photos, accessibility_profiles, ai_usage restart identity; delete from facilities where id > 14; delete from users where role <> 'admin';\"" 2>&1 | tail -2
