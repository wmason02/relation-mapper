import express from 'express';
import { MongoClient } from 'mongodb';
import multer from 'multer';
import path from 'path';
import { Graph } from 'graphlib';
import { rename } from 'fs/promises';

const app = express();

// MongoDB setup
const url = 'mongodb://localhost:27017';
const dbName = 'shortestPathDB';
const client = new MongoClient(url);

// Multer setup for file uploads
const upload = multer ({ dest: 'uploads/' });

// Middleware setup
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(import.meta.dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(import.meta.dirname, 'views'));

const graph = new Graph();

async function loadData() {
    try {
        await client.connect();
        const db = client.db(dbName);
        const nodesCollection = db.collection('nodes');
        const edgesCollection = db.collection('edges');

        const nodes = await nodesCollection.find({}).toArray();
        const edges = await edgesCollection.find({}).toArray();

        nodes.forEach(node => graph.setNode(node._id, { name: node.name }));
        edges.forEach(edge => {
            graph.setEdge(edge.nodes[0], edge.nodes[1], { image: edge.image });
            graph.setEdge(edge.nodes[1], edge.nodes[0], { image: edge.image });
        });
        console.log('Data loaded into graph');
    } catch (error) {
        console.error('Error loading data: ', error)
    }
}


//Routes

// Home page
app.get('/', (req, res) => {
    res.render('index');
})

// Upload page
app.get('/upload', (req, res) => {
    res.render('upload');
})

app.post('/upload', upload.single('image'), async (req, res) => {
    const { person1, person2, person1Id, person2Id } = req.body;

    // Create IDs if they don't exist
    const generatedId1 = person1Id || person1.replace(/\s+/g, '_');
    const generatedId2 = person2Id || person2.replace(/\s+/g, '_');

    // Ensure names are in alphabetical order
    const [firstPerson, secondPerson] =
        generatedId1.localeCompare(generatedId2) < 0
            ? [generatedId1, generatedId2]
            : [generatedId2, generatedId1];

    const oldPath = req.file.path;
    const fileExtension = path.extname(req.file.originalname) || '.jpg';
    const newFileName = `${firstPerson}_${secondPerson}${fileExtension}`;
    const newPath = path.join(import.meta.dirname, 'public', 'images', newFileName);

    const db = client.db(dbName);

    try {
        const nodesCollection = db.collection('nodes');
        const edgesCollection = db.collection('edges');

        // Insert or update nodes
        await nodesCollection.updateOne(
            { _id: generatedId1 },
            { $set: { _id: generatedId1, name: person1 } },
            { upsert: true }
        );

        await nodesCollection.updateOne(
            { _id: generatedId2 },
            { $set: { _id: generatedId2, name: person2 } },
            { upsert: true }
        );

        // Insert or update edge
        const edge = { nodes: [generatedId1, generatedId2], image: `images/${newFileName}` };
        await edgesCollection.updateOne(
            { nodes: edge.nodes },
            { $set: edge },
            { upsert: true }
        );

        // Update graph
        graph.setNode(generatedId1, { name: person1 });
        graph.setNode(generatedId2, { name: person2 });
        graph.setEdge(generatedId1, generatedId2, { image: `images/${newFileName}` });
        graph.setEdge(generatedId2, generatedId1, { image: `images/${newFileName}` });

        // Rename the uploaded file
        await rename(oldPath, newPath);
        console.log('File renamed successfully to:', newFileName);

        res.redirect('/upload');
    } catch (error) {
        console.error('Error uploading data:', error);
        res.status(500).send('Error uploading data');
    }
});

// Find Path Route
app.post('/find_path', (req, res) => {
    const startId = req.body.startId;
    const endId = req.body.endId;

    const path = findShortestPath(startId, endId);

    if (path) {
        const images = [];

        // Process the path and gather images and labels
        for (let i = 0; i < path.length - 1; i++) {
            const edge = graph.edge(path[i], path[i + 1]);
            if (edge) {
                images.push({
                    image: edge.image,
                    caption: `${graph.node(path[i]).name} and ${graph.node(path[i + 1]).name}`
                });
            }
        }

        res.render('path', { start: req.body.startName, end: req.body.endName, images });
    } else {
        res.render('path', { start: req.body.startName, end: req.body.endName, images: [] });
    }
});

function findShortestPath(start, end) {
    const queue = [start];
    const visited = new Set();
    const predecessor = {};

    while (queue.length > 0) {
        const current = queue.shift();

        if (current === end) {
            const path = [];
            let step = end;
            while (step) {
                path.unshift(step);
                step = predecessor[step];
            }
            return path;
        }

        visited.add(current);

        const neighbors = graph.successors(current) || [];
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push(neighbor);
                predecessor[neighbor] = current;
            }
        }
    }
    return null;
}

// Fetch Names for Dropdown
app.get('/names', async (req, res) => {
    const query = req.query.query || '';
    const db = client.db(dbName);
    const nodesCollection = db.collection('nodes');

    const names = await nodesCollection
        .find({ name: { $regex: query, $options: 'i' } }) // Case-insensitive search
        .toArray();

    res.json(names.map(node => ({ _id: node._id, name: node.name })));
});


// Start the Server
const PORT = 3000;
app.listen(PORT, () => {
    loadData().then(() => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
});