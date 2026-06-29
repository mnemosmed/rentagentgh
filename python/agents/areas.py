DEFAULT_AREAS = [
    "East Legon",
    "Cantonments",
    "Airport Residential",
    "Osu",
    "Labone",
    "Dzorwulu",
    "Roman Ridge",
    "Tema",
    "Spintex",
    "Adjiringanor",
    "Trasacco",
    "North Legon",
    "Airport City",
    "Ridge",
]


def get_all_areas():
    from .models import Agent

    areas = set(DEFAULT_AREAS)
    for agent in Agent.objects.all():
        areas.update(agent.covered_areas or [])
    return sorted(areas, key=str.lower)
