#!/usr/bin/env python3
"""
ABYSS DIVER - A Deep Ocean Roguelike
=====================================
Descend into the crushing darkness of the deep ocean.
Explore procedurally generated levels, battle sea creatures,
collect treasure, and try to reach the legendary Abyssal Vault.

Controls:
  Arrow keys / WASD / HJKL - Move
  .                         - Wait a turn
  g                         - Pick up item
  i                         - Inventory
  d                         - Drop item
  ?                         - Help
  q                         - Quit

Enemies:
  j - Jellyfish (weak, stuns)
  s - Shark (fast, strong)
  a - Anglerfish (lures, high damage)
  k - Kraken tentacle (slows)
  e - Electric eel (zaps adjacent tiles)
  G - Giant squid (boss)

Items:
  ! - Oxygen canister (+O2)
  / - Harpoon gun (ranged)
  * - Depth charge (area damage)
  ^ - Sonar ping (reveals map)
  + - Medkit (restore HP)
  $ - Treasure (score)
"""

import curses
import random
import sys
from collections import deque
from dataclasses import dataclass, field
from typing import List, Optional, Tuple, Dict


# ── Constants ──────────────────────────────────────────────────────────────────

SCREEN_W = 80
SCREEN_H = 24
MAP_W = 60
MAP_H = 20
PANEL_X = MAP_W + 1

MAX_DEPTH = 10          # number of floors
O2_MAX = 100
O2_DRAIN_RATE = 1       # O2 lost per turn (increases with depth)
VISIBILITY_BASE = 6     # tiles visible without light source

# Colors (pair numbers)
C_DEFAULT   = 0
C_WALL      = 1
C_FLOOR     = 2
C_WATER     = 3
C_PLAYER    = 4
C_ENEMY     = 5
C_ITEM      = 6
C_UI        = 7
C_DANGER    = 8
C_BOSS      = 9
C_DARK      = 10
C_CORAL     = 11
C_TREASURE  = 12


# ── Data classes ───────────────────────────────────────────────────────────────

@dataclass
class Tile:
    walkable: bool = False
    transparent: bool = False
    glyph: str = '#'
    color: int = C_WALL
    explored: bool = False
    visible: bool = False


@dataclass
class Item:
    name: str
    glyph: str
    color: int
    kind: str           # 'oxygen','weapon','explosive','sonar','medkit','treasure'
    value: int = 0      # HP restored / damage / O2 restored / score


@dataclass
class Enemy:
    name: str
    glyph: str
    color: int
    hp: int
    max_hp: int
    attack: int
    defense: int
    speed: int          # 1=slow,2=normal,3=fast
    x: int = 0
    y: int = 0
    stunned: int = 0    # turns stunned
    slowed: int = 0
    alive: bool = True
    is_boss: bool = False

    def move_towards(self, tx, ty, game_map, entities):
        """Simple BFS pathfinding towards target."""
        if self.stunned > 0:
            self.stunned -= 1
            return
        if self.slowed > 0:
            self.slowed -= 1
            if random.random() < 0.5:
                return

        path = bfs(self.x, self.y, tx, ty, game_map, entities)
        if path and len(path) > 1:
            nx, ny = path[1]
            self.x, self.y = nx, ny


@dataclass
class Player:
    x: int = MAP_W // 2
    y: int = MAP_H // 2
    hp: int = 30
    max_hp: int = 30
    oxygen: float = 100.0
    attack: int = 5
    defense: int = 2
    depth: int = 1
    score: int = 0
    inventory: List[Item] = field(default_factory=list)
    has_light: bool = False
    messages: deque = field(default_factory=lambda: deque(maxlen=5))
    turn: int = 0
    kills: int = 0

    def log(self, msg: str):
        self.messages.appendleft(msg)

    @property
    def alive(self):
        return self.hp > 0 and self.oxygen > 0


# ── Map generation ─────────────────────────────────────────────────────────────

def make_tile(walkable: bool, glyph: str, color: int) -> Tile:
    return Tile(walkable=walkable, transparent=walkable, glyph=glyph, color=color)


def new_map() -> List[List[Tile]]:
    return [[make_tile(False, '#', C_WALL) for _ in range(MAP_W)]
            for _ in range(MAP_H)]


def carve_room(game_map, x1, y1, x2, y2, depth):
    for y in range(y1, y2 + 1):
        for x in range(x1, x2 + 1):
            if 0 < y < MAP_H - 1 and 0 < x < MAP_W - 1:
                glyph = '~' if random.random() < 0.05 else '.'
                color = C_WATER if glyph == '~' else C_FLOOR
                game_map[y][x] = make_tile(True, glyph, color)
    # Scatter coral decorations
    for _ in range((x2 - x1) * (y2 - y1) // 8):
        cx = random.randint(x1, x2)
        cy = random.randint(y1, y2)
        if 0 < cy < MAP_H - 1 and 0 < cx < MAP_W - 1:
            game_map[cy][cx] = Tile(walkable=False, transparent=True,
                                    glyph=random.choice(['‡', 'ψ', '§', 'Ω']),
                                    color=C_CORAL)


def carve_tunnel_h(game_map, x1, x2, y):
    for x in range(min(x1, x2), max(x1, x2) + 1):
        if 0 < y < MAP_H - 1 and 0 < x < MAP_W - 1:
            game_map[y][x] = make_tile(True, '.', C_FLOOR)


def carve_tunnel_v(game_map, y1, y2, x):
    for y in range(min(y1, y2), max(y1, y2) + 1):
        if 0 < y < MAP_H - 1 and 0 < x < MAP_W - 1:
            game_map[y][x] = make_tile(True, '.', C_FLOOR)


def generate_level(depth: int) -> Tuple[List[List[Tile]], List[Tuple[int,int]], Tuple[int,int], Tuple[int,int]]:
    """Returns (map, rooms_centers, player_start, stairs_down)."""
    game_map = new_map()
    rooms = []  # (x1,y1,x2,y2)

    num_rooms = random.randint(6, 12)
    for _ in range(200):
        if len(rooms) >= num_rooms:
            break
        w = random.randint(4, 10)
        h = random.randint(3, 7)
        x = random.randint(1, MAP_W - w - 2)
        y = random.randint(1, MAP_H - h - 2)
        # Check overlap
        new_room = (x, y, x + w, y + h)
        overlap = False
        for r in rooms:
            if (x <= r[2] + 1 and x + w >= r[0] - 1 and
                    y <= r[3] + 1 and y + h >= r[1] - 1):
                overlap = True
                break
        if not overlap:
            carve_room(game_map, x, y, x + w, y + h, depth)
            rooms.append(new_room)

    # Connect rooms with tunnels
    for i in range(1, len(rooms)):
        prev_cx = (rooms[i-1][0] + rooms[i-1][2]) // 2
        prev_cy = (rooms[i-1][1] + rooms[i-1][3]) // 2
        curr_cx = (rooms[i][0] + rooms[i][2]) // 2
        curr_cy = (rooms[i][1] + rooms[i][3]) // 2
        if random.random() < 0.5:
            carve_tunnel_h(game_map, prev_cx, curr_cx, prev_cy)
            carve_tunnel_v(game_map, prev_cy, curr_cy, curr_cx)
        else:
            carve_tunnel_v(game_map, prev_cy, curr_cy, prev_cx)
            carve_tunnel_h(game_map, prev_cx, curr_cx, curr_cy)

    centers = [((r[0] + r[2]) // 2, (r[1] + r[3]) // 2) for r in rooms]
    player_start = centers[0]
    stairs = centers[-1]
    # Place stairs glyph
    sx, sy = stairs
    game_map[sy][sx] = Tile(walkable=True, transparent=True, glyph='>', color=C_ITEM, explored=False)

    return game_map, centers, player_start, stairs


def get_walkable_cells(game_map) -> List[Tuple[int,int]]:
    cells = []
    for y in range(MAP_H):
        for x in range(MAP_W):
            if game_map[y][x].walkable and game_map[y][x].glyph not in ('>', ):
                cells.append((x, y))
    return cells


# ── Spawning ───────────────────────────────────────────────────────────────────

ENEMY_TEMPLATES = {
    'jellyfish': lambda: Enemy('Jellyfish',    'j', C_ENEMY, 4,  4,  2, 0, 2),
    'shark':     lambda: Enemy('Shark',        's', C_ENEMY, 12, 12, 6, 1, 3),
    'anglerfish':lambda: Enemy('Anglerfish',   'a', C_ENEMY, 8,  8,  5, 2, 1),
    'eel':       lambda: Enemy('Electric Eel', 'e', C_ENEMY, 6,  6,  4, 1, 2),
    'kraken_t':  lambda: Enemy('Kraken Tentacle','k',C_ENEMY,10,10,  4, 3, 2),
    'squid_boss':lambda: Enemy('Giant Squid',  'G', C_BOSS, 40, 40, 10, 5, 2, is_boss=True),
}

DEPTH_ENEMIES = {
    1: ['jellyfish', 'jellyfish', 'shark'],
    2: ['jellyfish', 'shark', 'eel'],
    3: ['shark', 'eel', 'anglerfish'],
    4: ['shark', 'anglerfish', 'kraken_t'],
    5: ['anglerfish', 'kraken_t', 'shark'],
}

ITEM_POOL = [
    Item('Oxygen Canister', '!', C_ITEM,     'oxygen',    35),
    Item('O2 Boost',        '!', C_WATER,    'oxygen',    60),
    Item('Harpoon Gun',     '/', C_ITEM,     'weapon',    10),
    Item('Depth Charge',    '*', C_DANGER,   'explosive',  8),
    Item('Sonar Ping',      '^', C_UI,       'sonar',      0),
    Item('Medkit',          '+', C_ITEM,     'medkit',    15),
    Item('Treasure Chest',  '$', C_TREASURE, 'treasure', 100),
    Item('Rare Artifact',   '$', C_TREASURE, 'treasure', 250),
    Item('Ancient Relic',   '$', C_TREASURE, 'treasure', 500),
]


def spawn_enemies(depth: int, centers: List[Tuple[int,int]], player_start: Tuple[int,int]) -> List[Enemy]:
    enemies = []
    pool = DEPTH_ENEMIES.get(min(depth, 5), DEPTH_ENEMIES[5])
    count = 3 + depth * 2
    for _ in range(count):
        kind = random.choice(pool)
        e = ENEMY_TEMPLATES[kind]()
        # Pick random room center away from player
        candidates = [c for c in centers if c != player_start]
        if candidates:
            cx, cy = random.choice(candidates)
            e.x = cx + random.randint(-2, 2)
            e.y = cy + random.randint(-1, 1)
            e.x = max(1, min(MAP_W - 2, e.x))
            e.y = max(1, min(MAP_H - 2, e.y))
        enemies.append(e)
    # Boss on floor 5 and 10
    if depth in (5, 10):
        boss = ENEMY_TEMPLATES['squid_boss']()
        if centers:
            bx, by = centers[len(centers) // 2]
            boss.x, boss.y = bx, by
        enemies.append(boss)
    return enemies


def spawn_items(game_map, centers: List[Tuple[int,int]], player_start: Tuple[int,int], depth: int) -> Dict[Tuple[int,int], Item]:
    items = {}
    pool = get_walkable_cells(game_map)
    count = 4 + depth
    placed = 0
    random.shuffle(pool)
    for (x, y) in pool:
        if placed >= count:
            break
        if (x, y) in items:
            continue
        # More treasure deeper
        weights = ([3] * 2 + [2] * 3 + [1, 1, 1] +
                   ([2] if depth >= 3 else [0]) +
                   ([3] if depth >= 5 else [0]))
        weights = [w for w in weights if w > 0]
        item = random.choices(ITEM_POOL[:len(weights)], weights=weights)[0]
        items[(x, y)] = item
        placed += 1
    return items


# ── Field of view ──────────────────────────────────────────────────────────────

def compute_fov(game_map, px, py, radius):
    """Simple raycasting FOV."""
    for row in game_map:
        for tile in row:
            tile.visible = False

    game_map[py][px].visible = True
    game_map[py][px].explored = True

    for angle_step in range(360):
        angle = angle_step * 3.14159 / 180.0
        rx, ry = float(px), float(py)
        dx = 0.70711 * (0.5 * __import__('math').cos(angle) + 0.5 * __import__('math').sin(angle))
        dy = 0.70711 * (0.5 * __import__('math').sin(angle) - 0.5 * __import__('math').cos(angle))
        # simplified: just cast a ray
        dx2 = __import__('math').cos(angle)
        dy2 = __import__('math').sin(angle)
        for _ in range(radius):
            rx += dx2
            ry += dy2
            ix, iy = int(rx + 0.5), int(ry + 0.5)
            if ix < 0 or ix >= MAP_W or iy < 0 or iy >= MAP_H:
                break
            tile = game_map[iy][ix]
            tile.visible = True
            tile.explored = True
            if not tile.transparent:
                break


# ── Pathfinding ────────────────────────────────────────────────────────────────

def bfs(sx, sy, tx, ty, game_map, entities) -> Optional[List[Tuple[int,int]]]:
    """BFS from (sx,sy) to (tx,ty). entities is a set of blocked (x,y)."""
    blocked = {(e.x, e.y) for e in entities if e.alive and (e.x != sx or e.y != sy)}
    queue = deque([(sx, sy, [(sx, sy)])])
    visited = {(sx, sy)}
    while queue:
        cx, cy, path = queue.popleft()
        if cx == tx and cy == ty:
            return path
        for dx, dy in [(-1,0),(1,0),(0,-1),(0,1)]:
            nx, ny = cx + dx, cy + dy
            if (nx, ny) in visited:
                continue
            if nx < 0 or nx >= MAP_W or ny < 0 or ny >= MAP_H:
                continue
            if not game_map[ny][nx].walkable:
                continue
            if (nx, ny) in blocked and not (nx == tx and ny == ty):
                continue
            visited.add((nx, ny))
            queue.append((nx, ny, path + [(nx, ny)]))
            if len(visited) > 300:  # limit search
                return None
    return None


# ── Combat ─────────────────────────────────────────────────────────────────────

def player_attack(player: Player, enemy: Enemy) -> str:
    dmg = max(0, player.attack - enemy.defense + random.randint(-1, 2))
    enemy.hp -= dmg
    if enemy.hp <= 0:
        enemy.alive = False
        player.score += (50 if enemy.is_boss else 10) * player.depth
        player.kills += 1
        return f"You slay the {enemy.name}! (+{(50 if enemy.is_boss else 10) * player.depth} pts)"
    return f"You hit the {enemy.name} for {dmg} dmg. ({enemy.hp}/{enemy.max_hp} HP)"


def enemy_attack(enemy: Enemy, player: Player) -> str:
    dmg = max(0, enemy.attack - player.defense + random.randint(-1, 2))
    player.hp -= dmg
    msg = f"{enemy.name} hits you for {dmg}!"
    # Special effects
    if enemy.glyph == 'j':  # jellyfish stun
        if random.random() < 0.3:
            msg += " Stunned!"
            # We'll handle stun via a player stun counter elsewhere
    if enemy.glyph == 'e':  # eel zap - extra O2 drain
        o2_loss = random.randint(3, 8)
        player.oxygen = max(0, player.oxygen - o2_loss)
        msg += f" Zapped! (-{o2_loss} O2)"
    if enemy.glyph == 'k':  # kraken slow
        msg += " Slowed!"
    return msg


def use_item(player: Player, item: Item, game_map, enemies) -> str:
    if item.kind == 'oxygen':
        gained = min(item.value, O2_MAX - player.oxygen)
        player.oxygen = min(O2_MAX, player.oxygen + item.value)
        return f"You breathe in {item.name}. (+{gained:.0f} O2)"
    elif item.kind == 'medkit':
        gained = min(item.value, player.max_hp - player.hp)
        player.hp = min(player.max_hp, player.hp + item.value)
        return f"You use {item.name}. (+{gained} HP)"
    elif item.kind == 'weapon':
        # Harpoon: damage closest visible enemy
        targets = [e for e in enemies if e.alive and game_map[e.y][e.x].visible]
        if targets:
            t = min(targets, key=lambda e: abs(e.x - player.x) + abs(e.y - player.y))
            dmg = item.value + player.attack
            t.hp -= dmg
            if t.hp <= 0:
                t.alive = False
                player.score += 10 * player.depth
                player.kills += 1
                return f"Harpoon pierces the {t.name} ({dmg} dmg)! It dies."
            return f"Harpoon hits the {t.name} for {dmg} dmg!"
        return "No target in sight."
    elif item.kind == 'explosive':
        # Depth charge: damages all enemies in radius 3
        killed = 0
        for e in enemies:
            if e.alive and abs(e.x - player.x) + abs(e.y - player.y) <= 4:
                e.hp -= item.value
                if e.hp <= 0:
                    e.alive = False
                    player.score += 10 * player.depth
                    player.kills += 1
                    killed += 1
        player.hp -= 3  # self-damage
        return f"BOOM! Depth charge injures {killed} creatures. (-3 HP self)"
    elif item.kind == 'sonar':
        for row in game_map:
            for tile in row:
                tile.explored = True
        return "Sonar ping! The entire level is revealed."
    elif item.kind == 'treasure':
        player.score += item.value
        return f"You collect the {item.name}! (+{item.value} pts)"
    return f"You fiddle with the {item.name}."


# ── Rendering ──────────────────────────────────────────────────────────────────

def draw_map(stdscr, game_map, player, enemies, items):
    enemy_pos = {(e.x, e.y): e for e in enemies if e.alive}
    for y in range(MAP_H):
        for x in range(MAP_W):
            tile = game_map[y][x]
            if not tile.explored:
                try:
                    stdscr.addch(y, x, ' ')
                except curses.error:
                    pass
                continue
            if tile.visible:
                # Player
                if x == player.x and y == player.y:
                    try:
                        stdscr.addch(y, x, '@',
                                     curses.color_pair(C_PLAYER) | curses.A_BOLD)
                    except curses.error:
                        pass
                    continue
                # Enemy
                if (x, y) in enemy_pos:
                    e = enemy_pos[(x, y)]
                    attr = curses.color_pair(C_BOSS if e.is_boss else C_ENEMY) | curses.A_BOLD
                    try:
                        stdscr.addch(y, x, e.glyph, attr)
                    except curses.error:
                        pass
                    continue
                # Item
                if (x, y) in items:
                    item = items[(x, y)]
                    try:
                        stdscr.addch(y, x, item.glyph,
                                     curses.color_pair(item.color) | curses.A_BOLD)
                    except curses.error:
                        pass
                    continue
                # Tile
                try:
                    glyph = tile.glyph
                    if isinstance(glyph, str) and len(glyph) == 1:
                        stdscr.addch(y, x, glyph, curses.color_pair(tile.color))
                    else:
                        stdscr.addch(y, x, '?', curses.color_pair(tile.color))
                except curses.error:
                    pass
            else:
                # Explored but not visible: dim
                try:
                    glyph = tile.glyph
                    if not isinstance(glyph, str) or len(glyph) != 1:
                        glyph = '?'
                    stdscr.addch(y, x, glyph,
                                 curses.color_pair(C_DARK) | curses.A_DIM)
                except curses.error:
                    pass


def draw_panel(stdscr, player: Player, depth: int):
    px = PANEL_X
    w = SCREEN_W - px - 1

    def put(row, text, color=C_UI, bold=False):
        attr = curses.color_pair(color)
        if bold:
            attr |= curses.A_BOLD
        try:
            stdscr.addstr(row, px, text[:w], attr)
        except curses.error:
            pass

    put(0,  "╔═ ABYSS DIVER ═╗", C_UI, True)
    put(1,  f" Depth:  {depth:>2} / {MAX_DEPTH}", C_UI)
    put(2,  f" Score:  {player.score}", C_TREASURE, True)
    put(3,  f" Kills:  {player.kills}", C_ENEMY)
    put(4,  "─" * (w), C_UI)

    # HP bar
    hp_pct = player.hp / player.max_hp
    hp_bar = int(hp_pct * (w - 7))
    hp_color = C_DANGER if hp_pct < 0.3 else C_ITEM
    put(5,  f" HP  [{('█' * hp_bar).ljust(w - 7)}]", hp_color)
    put(6,  f"     {player.hp}/{player.max_hp}", hp_color)

    # O2 bar
    o2_pct = player.oxygen / O2_MAX
    o2_bar = int(o2_pct * (w - 7))
    o2_color = C_DANGER if o2_pct < 0.25 else C_WATER
    put(7,  f" O2  [{('░' * o2_bar).ljust(w - 7)}]", o2_color)
    put(8,  f"     {player.oxygen:.0f}/{O2_MAX}", o2_color)

    put(9,  "─" * w, C_UI)
    put(10, f" Items: {len(player.inventory)}", C_ITEM)
    put(11, "─" * w, C_UI)

    # Messages
    put(12, " Log:", C_UI, True)
    for i, msg in enumerate(player.messages):
        color = C_DANGER if any(w in msg for w in ['hit','slay','die','dead','BOOM']) else C_DEFAULT
        put(13 + i, f" {msg}"[:w], color)


def draw_messages_bar(stdscr, player: Player):
    """Bottom status line."""
    msg = list(player.messages)[0] if player.messages else ""
    try:
        stdscr.addstr(MAP_H, 0, msg[:MAP_W], curses.color_pair(C_UI))
    except curses.error:
        pass
    try:
        stdscr.addstr(MAP_H + 1, 0,
                      "[Arrows/WASD] Move  [g] Pick up  [i] Inventory  [q] Quit  [?] Help",
                      curses.color_pair(C_DARK))
    except curses.error:
        pass


def draw_inventory(stdscr, player: Player) -> Optional[int]:
    """Show inventory screen, return index of selected item or None."""
    stdscr.clear()
    title = "─── INVENTORY ──────────────────────────────"
    try:
        stdscr.addstr(0, 0, title, curses.color_pair(C_UI) | curses.A_BOLD)
    except curses.error:
        pass

    if not player.inventory:
        try:
            stdscr.addstr(2, 2, "(empty)", curses.color_pair(C_DARK))
            stdscr.addstr(4, 0, "Press any key to close.", curses.color_pair(C_UI))
        except curses.error:
            pass
        stdscr.refresh()
        stdscr.getch()
        return None

    for i, item in enumerate(player.inventory):
        line = f" {i+1}. [{item.glyph}] {item.name}"
        try:
            stdscr.addstr(2 + i, 0, line, curses.color_pair(item.color))
        except curses.error:
            pass
    try:
        stdscr.addstr(2 + len(player.inventory) + 1, 0,
                      "Press number to USE item, 'd'+number to DROP, ESC to cancel.",
                      curses.color_pair(C_UI))
    except curses.error:
        pass
    stdscr.refresh()

    while True:
        key = stdscr.getch()
        if key == 27:  # ESC
            return None
        if ord('1') <= key <= ord('9'):
            idx = key - ord('1')
            if idx < len(player.inventory):
                return idx
        if key in (ord('d'), ord('D')):
            try:
                stdscr.addstr(2 + len(player.inventory) + 2, 0,
                               "Drop which item? (number)  ",
                               curses.color_pair(C_DANGER))
            except curses.error:
                pass
            stdscr.refresh()
            k2 = stdscr.getch()
            if ord('1') <= k2 <= ord('9'):
                idx = k2 - ord('1')
                if idx < len(player.inventory):
                    dropped = player.inventory.pop(idx)
                    player.log(f"Dropped {dropped.name}.")
                    return None
    return None


def draw_help(stdscr):
    stdscr.clear()
    lines = [
        "─── HELP ──────────────────────────────────────",
        "",
        "  Arrow keys / WASD / HJKL  Move one step",
        "  .                         Wait a turn",
        "  g                         Pick up item at your feet",
        "  i                         Open inventory",
        "  d                         Drop item (via inventory)",
        "  ?                         This help screen",
        "  q                         Quit game",
        "",
        "  >  Stairs down (step on to descend)",
        "",
        "  Enemies:",
        "    j Jellyfish  – stuns occasionally",
        "    s Shark      – fast and strong",
        "    a Anglerfish – slow but hard-hitting",
        "    e Electric Eel – drains your oxygen",
        "    k Kraken Tentacle – slows movement",
        "    G Giant Squid – floor boss",
        "",
        "  Watch your O2! It drains every turn.",
        "  Deeper floors drain O2 faster.",
        "",
        "  Press any key to close.",
    ]
    for i, line in enumerate(lines):
        try:
            stdscr.addstr(i, 0, line, curses.color_pair(C_UI))
        except curses.error:
            pass
    stdscr.refresh()
    stdscr.getch()


def draw_game_over(stdscr, player: Player, won: bool):
    stdscr.clear()
    if won:
        msg = "YOU REACHED THE ABYSSAL VAULT!"
        color = C_TREASURE
    elif player.oxygen <= 0:
        msg = "YOU SUFFOCATED IN THE DEEP."
        color = C_DANGER
    else:
        msg = "YOU WERE CONSUMED BY THE ABYSS."
        color = C_DANGER

    art = [
        r"    ~~~  GAME OVER  ~~~    ",
        r"   ~~~~~~~~~~~~~~~~~~~~~   ",
        r"  ~~ DEEP OCEAN AWAITS ~~  ",
        r"   ~~~~~~~~~~~~~~~~~~~~~   ",
    ]
    row = 3
    for line in art:
        try:
            stdscr.addstr(row, 5, line, curses.color_pair(C_WATER) | curses.A_BOLD)
        except curses.error:
            pass
        row += 1

    try:
        stdscr.addstr(row + 1, 5, msg, curses.color_pair(color) | curses.A_BOLD)
        stdscr.addstr(row + 3, 5, f"Final Score:  {player.score}", curses.color_pair(C_TREASURE))
        stdscr.addstr(row + 4, 5, f"Depth reached: {player.depth}", curses.color_pair(C_UI))
        stdscr.addstr(row + 5, 5, f"Enemies slain: {player.kills}", curses.color_pair(C_ENEMY))
        stdscr.addstr(row + 7, 5, "Press any key to exit.", curses.color_pair(C_UI))
    except curses.error:
        pass

    stdscr.refresh()
    stdscr.getch()


def draw_title(stdscr):
    stdscr.clear()
    title_art = [
        "  █████╗ ██████╗ ██╗   ██╗███████╗███████╗",
        " ██╔══██╗██╔══██╗╚██╗ ██╔╝██╔════╝██╔════╝",
        " ███████║██████╔╝ ╚████╔╝ ███████╗███████╗",
        " ██╔══██║██╔══██╗  ╚██╔╝  ╚════██║╚════██║",
        " ██║  ██║██████╔╝   ██║   ███████║███████║",
        " ╚═╝  ╚═╝╚═════╝    ╚═╝   ╚══════╝╚══════╝",
        "",
        "  ██████╗ ██╗██╗   ██╗███████╗██████╗     ",
        "  ██╔══██╗██║██║   ██║██╔════╝██╔══██╗    ",
        "  ██║  ██║██║██║   ██║█████╗  ██████╔╝    ",
        "  ██║  ██║██║╚██╗ ██╔╝██╔══╝  ██╔══██╗    ",
        "  ██████╔╝██║ ╚████╔╝ ███████╗██║  ██║    ",
        "  ╚═════╝ ╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝    ",
    ]
    for i, line in enumerate(title_art):
        try:
            stdscr.addstr(i, 0, line, curses.color_pair(C_WATER) | curses.A_BOLD)
        except curses.error:
            pass
    try:
        stdscr.addstr(15, 5, "A Deep Ocean Roguelike", curses.color_pair(C_UI))
        stdscr.addstr(17, 5, "Descend 10 floors to claim the Abyssal Vault.", curses.color_pair(C_FLOOR))
        stdscr.addstr(18, 5, "Manage your oxygen. Fear the dark.", curses.color_pair(C_DANGER))
        stdscr.addstr(20, 5, "Press any key to begin your descent...", curses.color_pair(C_ITEM) | curses.A_BOLD)
    except curses.error:
        pass
    stdscr.refresh()
    stdscr.getch()


# ── Main game loop ─────────────────────────────────────────────────────────────

def setup_colors():
    curses.start_color()
    curses.use_default_colors()
    curses.init_pair(C_WALL,     curses.COLOR_BLUE,    -1)
    curses.init_pair(C_FLOOR,    curses.COLOR_WHITE,   -1)
    curses.init_pair(C_WATER,    curses.COLOR_CYAN,    -1)
    curses.init_pair(C_PLAYER,   curses.COLOR_WHITE,   -1)
    curses.init_pair(C_ENEMY,    curses.COLOR_RED,     -1)
    curses.init_pair(C_ITEM,     curses.COLOR_GREEN,   -1)
    curses.init_pair(C_UI,       curses.COLOR_CYAN,    -1)
    curses.init_pair(C_DANGER,   curses.COLOR_RED,     -1)
    curses.init_pair(C_BOSS,     curses.COLOR_MAGENTA, -1)
    curses.init_pair(C_DARK,     curses.COLOR_BLUE,    -1)
    curses.init_pair(C_CORAL,    curses.COLOR_MAGENTA, -1)
    curses.init_pair(C_TREASURE, curses.COLOR_YELLOW,  -1)


def load_level(player: Player):
    depth = player.depth
    game_map, centers, start, stairs = generate_level(depth)
    player.x, player.y = start
    enemies = spawn_enemies(depth, centers, start)
    items = spawn_items(game_map, centers, start, depth)
    player.log(f"You descend to depth {depth}...")
    return game_map, enemies, items, stairs


def main(stdscr):
    curses.curs_set(0)
    stdscr.keypad(True)
    stdscr.timeout(100)
    setup_colors()

    draw_title(stdscr)

    player = Player()
    game_map, enemies, items, stairs = load_level(player)
    player_stun = 0  # turns player can't move

    won = False
    running = True

    while running and player.alive:
        # FOV
        vis_radius = VISIBILITY_BASE + (2 if player.has_light else 0)
        compute_fov(game_map, player.x, player.y, vis_radius)

        # Draw
        stdscr.erase()
        draw_map(stdscr, game_map, player, enemies, items)

        # Vertical divider
        for y in range(MAP_H):
            try:
                stdscr.addch(y, MAP_W, '│', curses.color_pair(C_UI))
            except curses.error:
                pass

        draw_panel(stdscr, player, player.depth)
        draw_messages_bar(stdscr, player)
        stdscr.refresh()

        # Input
        key = stdscr.getch()
        if key == -1:
            continue

        moved = False
        dx, dy = 0, 0

        if key in (curses.KEY_UP,    ord('w'), ord('W'), ord('k')):
            dx, dy = 0, -1; moved = True
        elif key in (curses.KEY_DOWN,  ord('s'), ord('S'), ord('j')):
            dx, dy = 0,  1; moved = True
        elif key in (curses.KEY_LEFT,  ord('a'), ord('A'), ord('h')):
            dx, dy = -1, 0; moved = True
        elif key in (curses.KEY_RIGHT, ord('d'), ord('D'), ord('l')):
            dx, dy =  1, 0; moved = True
        elif key == ord('.'):
            moved = True  # wait
        elif key in (ord('g'), ord('G')):
            pos = (player.x, player.y)
            if pos in items:
                it = items.pop(pos)
                if it.kind == 'treasure':
                    player.score += it.value
                    player.log(f"You grab the {it.name}! (+{it.value} pts)")
                else:
                    player.inventory.append(it)
                    player.log(f"You pick up {it.name}.")
            else:
                player.log("Nothing here to pick up.")
            moved = True
        elif key in (ord('i'), ord('I')):
            idx = draw_inventory(stdscr, player)
            if idx is not None and idx < len(player.inventory):
                it = player.inventory.pop(idx)
                msg = use_item(player, it, game_map, enemies)
                player.log(msg)
            continue
        elif key == ord('?'):
            draw_help(stdscr)
            continue
        elif key in (ord('q'), ord('Q')):
            break

        if not moved:
            continue

        if player_stun > 0:
            player_stun -= 1
            player.log("You are stunned!")
            # O2 drain still happens
            drain = O2_DRAIN_RATE * (1 + player.depth * 0.1)
            player.oxygen = max(0, player.oxygen - drain)
            player.turn += 1
            continue

        # Attempt move
        if dx != 0 or dy != 0:
            nx, ny = player.x + dx, player.y + dy
            if 0 <= nx < MAP_W and 0 <= ny < MAP_H:
                # Check enemy collision (attack)
                enemy_here = next((e for e in enemies
                                   if e.alive and e.x == nx and e.y == ny), None)
                if enemy_here:
                    msg = player_attack(player, enemy_here)
                    player.log(msg)
                    # Jellyfish stun
                    if enemy_here.alive and enemy_here.glyph == 'j' and random.random() < 0.25:
                        player_stun = 2
                        player.log("The jellyfish stuns you!")
                elif game_map[ny][nx].walkable:
                    player.x, player.y = nx, ny
                    # Check stairs
                    if game_map[ny][nx].glyph == '>':
                        if player.depth >= MAX_DEPTH:
                            won = True
                            running = False
                        else:
                            player.depth += 1
                            game_map, enemies, items, stairs = load_level(player)
                            player.turn += 1
                            continue

        # O2 drain
        drain = O2_DRAIN_RATE * (1 + player.depth * 0.15)
        player.oxygen = max(0, player.oxygen - drain)

        # Enemy turns
        alive_enemies = [e for e in enemies if e.alive]
        for e in alive_enemies:
            if not e.alive:
                continue
            dist = abs(e.x - player.x) + abs(e.y - player.y)
            # Only move if player is visible or within range
            if not game_map[e.y][e.x].visible and dist > 8:
                continue
            if dist == 1:
                msg = enemy_attack(e, player)
                player.log(msg)
            else:
                steps = e.speed
                for _ in range(steps):
                    if not e.alive:
                        break
                    dist2 = abs(e.x - player.x) + abs(e.y - player.y)
                    if dist2 > 1:
                        e.move_towards(player.x, player.y, game_map, alive_enemies)
                    else:
                        break
                # After moving, attack if adjacent
                dist2 = abs(e.x - player.x) + abs(e.y - player.y)
                if dist2 == 1:
                    msg = enemy_attack(e, player)
                    player.log(msg)

        # Electric eel AOE
        for e in alive_enemies:
            if e.glyph == 'e' and e.alive:
                if abs(e.x - player.x) <= 2 and abs(e.y - player.y) <= 2:
                    if random.random() < 0.2:
                        zap = random.randint(1, 4)
                        player.oxygen = max(0, player.oxygen - zap)
                        player.log(f"Electric field zaps you! (-{zap} O2)")

        player.turn += 1
        enemies = [e for e in enemies]  # keep dead for record

    # Game over screen
    if not player.alive:
        won = False
    compute_fov(game_map, player.x, player.y, VISIBILITY_BASE)
    stdscr.erase()
    draw_map(stdscr, game_map, player, enemies, items)
    stdscr.refresh()
    curses.napms(400)
    draw_game_over(stdscr, player, won)


def run():
    if len(sys.argv) > 1 and sys.argv[1] in ('-h', '--help'):
        print(__doc__)
        return
    try:
        curses.wrapper(main)
    except KeyboardInterrupt:
        pass
    print("Thanks for playing ABYSS DIVER!")


if __name__ == '__main__':
    run()
