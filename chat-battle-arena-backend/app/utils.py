def compute_damage_based_on_attack_id(attack_id):
    damage_mapping = {
        1: 1,
        2: 2,
        3: 2,
        4: 5,
        5: 5,
        6: 5,
        7: 5,
        8: 10,
        9: 3,
        10: 7,
        11: 14,
        12: 2,
        13: 4,
        14: 7,
        15: 10,
        16: 16,
    }
    return damage_mapping.get(attack_id, 0)
