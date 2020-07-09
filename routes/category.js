const express = require('express');
const router = express.Router();
const database = require('../database');

// router.get('/postall', async (req, res) =>{
//   const response = await database.insert(CATEGORIES).into('categories');
//   res.json('success');
// })

router.get('/', async (req, res) => {
  try {
    const categories = await database.select('*').from('categories');
    setTimeout(()=>{
      res.status(200).json(categories)
    }, 2000)
    
  } catch (error) {
    res.status(400).json("Error fetching categories")
  }
});

router.get('/hottest', async (req, res) =>{
  try {
    const hottestCategories = await database.select('*').from('categories').where('title', 'ilike', '%%').limit(2);
    res.status(200).json(hottestCategories)
  } catch (error) {
    res.status(400).json("Error fetching hottest categories")
  }
})





module.exports = router;