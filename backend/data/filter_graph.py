import json
import math
from collections import defaultdict

def distance(lat1, lon1, lat2, lon2):
    # simple euclidean distance for small radius
    return math.sqrt((lat1 - lat2)**2 + (lon1 - lon2)**2)

with open('graph.json') as f:
    data = json.load(f)

nodes = data['nodes']
edges = data['edges']

# calculate degree
degree = defaultdict(int)
for e in edges:
    degree[e['source']] += 1
    degree[e['target']] += 1

# pick highest degree node
center_id = max(degree, key=degree.get)
center_node = next(n for n in nodes if n['id'] == center_id)

# calculate distance to center for all nodes
distances = []
for n in nodes:
    dist = distance(center_node['location']['lat'], center_node['location']['lng'], n['location']['lat'], n['location']['lng'])
    distances.append((dist, n))

# sort by distance and pick top 20
distances.sort(key=lambda x: x[0])
top_20_nodes = [n for d, n in distances[:20]]
top_20_ids = {n['id'] for n in top_20_nodes}

# filter edges
filtered_edges = [e for e in edges if e['source'] in top_20_ids and e['target'] in top_20_ids]

data['nodes'] = top_20_nodes
data['edges'] = filtered_edges

# update bounding box
lats = [n['location']['lat'] for n in top_20_nodes]
lngs = [n['location']['lng'] for n in top_20_nodes]
if lats and lngs:
    data['locality']['bounding_box'] = {
        'south': min(lats),
        'west': min(lngs),
        'north': max(lats),
        'east': max(lngs)
    }

with open('graph.json', 'w') as f:
    json.dump(data, f, indent=2)

print("Saved graph with", len(data['nodes']), "nodes and", len(data['edges']), "edges.")
