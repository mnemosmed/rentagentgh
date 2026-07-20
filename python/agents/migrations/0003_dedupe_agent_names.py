from django.db import migrations


def forwards(apps, schema_editor):
    from agents.dedupe import merge_duplicate_agents

    merge_duplicate_agents()


def backwards(apps, schema_editor):
    # Cannot restore deleted duplicate agents.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("agents", "0002_initial"),
        ("messaging", "0002_conversation_agent_notified_at"),
        ("payments", "0002_access_pass"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
