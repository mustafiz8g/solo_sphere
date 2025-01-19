const express = require('express')
const cors = require('cors')

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
require('dotenv').config()
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const port = process.env.PORT || 9000
const app = express()

const corsOption = {
  origin: ['http://localhost:5173'],
  credentials: true, optionalSuccessStatus: 200,

}

app.use(cors(corsOption))
app.use(express.json())
app.use(cookieParser())

// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@main.yolij.mongodb.net/?retryWrites=true&w=majority&appName=Main`
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nq2rk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

// verrify token
 const verrifyToken = (req, res, next) => {
   const token = req.cookies?.token
  //  console.log(token)
  if(!token) return res.status(401).send({ message: 'Unauthorized access' })
    jwt.verify(token, process.env.SECRET_KEY, (err, decoded)=>{
  if(err) {
    return res.status(401).send({message : 'unauthorized access'})
  }
    req.user = decoded
    })
  next()

 }

async function run() {
  try {

    const jobsCollection = client.db('solo_db').collection('jobs')
    const bidsCollection = client.db('solo_db').collection('bids')
    // generate jwt --------------------------
    app.post('/jwt', async(req, res) => {
      const email = req.body;
      // create token
      const token = jwt.sign(email, process.env.SECRET_KEY, {expiresIn: '300d'} )
      console.log(token)
      res.cookie('token', token,{
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
      }).send({success: true})
    } )

    // log out || clear cookie from brower
    app.get('/logout', async(req, res) => {
      res.clearCookie('token',  {
        maxAge: 0,
         secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
      }).send({success: true})
    })


    app.post('/add-job', async(req,res) => {
      const jobData = req.body
      const result = await jobsCollection.insertOne(jobData)
      console.log(jobData)
      res.send(result)
    })
    app.get('/jobs', async(req, res) => {
      const result = await jobsCollection.find().toArray()
      res.send(result)
    })
    // get  all job posted by a specific user
    app.get('/jobs/:email',verrifyToken, async(req, res) => {
      const email = req.params.email;
      const decodedEmail = req.user?.email
      // console.log('email form token', decodedEmail)
      // console.log('email form params ', email)
      if(decodedEmail !== email)   return res.status(401).send({message : 'unauthorized access'})
      const query = { 'buyer.email' : email }
      const result = await jobsCollection.find(query).toArray()
      res.send(result)
    })
    //posted job delet
    app.delete('/job/:id',verrifyToken, async(req,res) => {
      const id = req.params.id;
      const query = { _id : new ObjectId(id)}
      const result = await jobsCollection.deleteOne(query)
      res.send(result);
    })

    app.get('/job/:id', async( req, res) => {
      const id = req.params.id;
      const query = { _id : new ObjectId(id)}
      const result = await jobsCollection.findOne(query)
      res.send(result)
    })

    
    app.put('/update-job/:id', async(req,res) => {
      const id = req.params.id;
      const jobData = req.body
      const updated = {
        $set: jobData
      }

      const query = { _id: new ObjectId(id) }
      const options = { upsert : true }

      const result = await jobsCollection.updateOne(query, updated, options)
      res.send(result)
    })

    // bid related api 
    // save a bid data
    app.post('/add-bid', async(req,res) => {
      const bidData = req.body
      // 0. check a user placed a bid already in this job
      const query = { email: bidData.email, jobId: bidData.jobId}
      const alreadyExist = await bidsCollection.findOne(query)
      console.log(alreadyExist)
      if(alreadyExist) return res
                             .status(400)
                             .send('you have already placed a bid on this job')
        console.log('If already exist -->', alreadyExist)

      // 1. save data in bid collection
      const result = await bidsCollection.insertOne(bidData)
      // 2 increase bid count in jobs collection
      const filter = { _id: new ObjectId(bidData.jobId)}
      const update = {
        $inc:{bid_count: 1},
      }
      const updateBidCount = await jobsCollection.updateOne(filter,update)
      // console.log(updateBidCount)
      res.send(result)
    })

    // get all bid for a specific user
    app.get('/bids/:email',verrifyToken, async(req, res) => {
      const isBuyer = req.query.buyer;
      const email = req.params.email;
      const decodedEmail = req.user?.email
      // console.log('email form token', decodedEmail)
      // console.log('email form params ', email)
      if(decodedEmail !== email)   return res.status(401).send({message : 'unauthorized access'})
      let query = {}
      if(isBuyer){
        // const query = { buyer: email }
        query.buyer = email
      }
      else{
        // const query = {email}
        query.email = email
      }
      // const email = req.params.email;
      const result = await bidsCollection.find(query).toArray();
      res.send(result)
    })
    // get all bid request for a specific user
    // app.get('/bid-requests/:email', async(req, res) => {
    //   const email = req.params.email;
    //   const query = { buyer: email }
    //   const result = await bidsCollection.find(query).toArray();
    //   res.send(result)
    // })

    // update bit status 
    app.patch('/bid-status/:id', async(req, res) => {
      const id = req.params.id
      const {status} = req.body;
      // return console.log(status)
      const filter = { _id: new ObjectId(id) }
      const updated = {
        $set: {  status }
      }
      const result = await bidsCollection.updateOne(filter,updated)
      res.send(result)

    })

    // get all jobbs
    app.get('/all-jobs', async(req, res) =>{
      const filter = req.query.filter;
      const search = req.query.search;
      const sort = req.query.sort;
      // console.log(search)
      let options = {}
      if(sort) options = {sort: {deadline: sort === 'asc'? 1 : -1}}
      let query = {title:{
        $regex: search,
        $options:'i'
      }}
      if(filter) query.category = filter
      const result = await jobsCollection.find(query, options).toArray()
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir)
app.get('/', (req, res) => {
  res.send('Hello from SoloSphere Server....')
})

app.listen(port, () => console.log(`Server running on port ${port}`))
