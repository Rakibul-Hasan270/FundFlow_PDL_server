const express = require('express');
require('dotenv').config();
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.PAYMENT_KEY)
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.7ks5x.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();

        const userCollection = client.db("FundFlow_PDL").collection('users');
        const campaignCollection = client.db("FundFlow_PDL").collection('campaigns');
        const reviewsCollection = client.db("FundFlow_PDL").collection('reviews');
        const donarInfoCollection = client.db("FundFlow_PDL").collection('donars');
        const paymentCollection = client.db("FundFlow_PDL").collection('payments');

        // jwt related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '1h' });
            res.send({ token });
        })

        // middleware verify token and verify admin
        const verifyToken = (req, res, next) => {
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'Unauthorized access' });
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN, (error, decoded) => {
                if (error) {
                    return res.status(401).send({ message: 'unauthorized access' });
                }
                req.decoded = decoded;
                next();
            })
        }

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbiden access' });
            }
            next();
        }

        // user related apis 
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await userCollection.insertOne(user);
            res.send(result);
        })

        // campaigns related apis 
        app.get('/campaigns', async (req, res) => {
            const result = await campaignCollection.find().toArray();
            res.send(result);
        })

        // app.get('/campaigns/:id', async (req, res) => {
        //     const id = req.params.id;
        //     const query = { _id: new ObjectId(id) };
        //     const result = await campaignCollection.findOne(query);
        //     res.send(result);
        // })

        // donar info ---- 
        app.post('/donar-info', verifyToken, async (req, res) => {
            const donar = req.body;
            const result = await donarInfoCollection.insertOne(donar);
            res.send(result);
        })

        app.get('/donar-info/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await donarInfoCollection.find(query).toArray();
            res.send(result);
        })

        // payment 
        app.post('/create-payment-intent', async (req, res) => {
            const { amountInCents } = req.body;
            if (!amountInCents) {
                return res.status(400).send({ error: 'Amount is required' });
            }

            try {
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amountInCents,
                    currency: 'usd',
                    payment_method_types: ['card']
                });

                res.send({ clientSecret: paymentIntent.client_secret });
            } catch (error) {
                console.error('Stripe PaymentIntent Error:', error);
                res.status(500).send({ error: error?.message });
            }
        });

        app.post('/payment', async (req, res) => {
            const payment = req.body;
            const insertResult = await paymentCollection.insertOne(payment);

            const query = {
                email: payment.email
            }
            const deleteResult = await donarInfoCollection.deleteMany(query);
            res.send({ insertResult, deleteResult });
        })

        app.get('/payment/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await paymentCollection.find(query).toArray();
            res.send(result);
        })


        // reviews related apis 
        app.get('/reviews', async (req, res) => {
            const result = await reviewsCollection.find().toArray();
            res.send(result);
        })

        app.post('/reviews', async (req, res) => {
            const review = req.body;
            const result = await reviewsCollection.insertOne(review);
            res.send(result);
        })


        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally { }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('restaurant is open');
})

app.listen(port, () => {
    console.log(`Zestora runing on port ${port}`);
})