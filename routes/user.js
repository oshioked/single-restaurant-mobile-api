const express = require('express');
const router = express.Router();
const database = require('../database');

// FETCH USER DATA
router.get('/:id', async (req, res)=>{
    const userId = req.params.id;
    try {
        const userData = await database.select('*').from('users').where('userid', '=', userId);
        const userPendingOrders = await database.select('*').from('orders').where({userid: userId, status: 'pending'});
        const orderItems = userPendingOrders.map(order => order.items)
        const orderItemsId = orderItems.flat(2).map(items => items.itemId);
        const orderItemsTitle = await database.select('id', 'title').from('meals').whereIn('id', orderItemsId);
        if(!userData[0]){
            res.status(400).json("User not found");
        }
        res.status(200).json({
            userid: userData[0].userid,
            fullname: userData[0].fullname,
            email: userData[0].email,
            phonenumber: userData[0].phonenumber,
            bonusprogress: userData[0].bonusprogress,
            address: userData[0].address,
            favoritemeals: userData[0].favoritemeals,
            orders: userPendingOrders.map(order => ({
                ...order, 
                items: order.items.map(item => ({
                    itemId: item.itemId,
                    itemQty: item.itemQty,
                    amount: item.amount, 
                    itemTitle: orderItemsTitle.find(itm => (itm.id === item.itemId)).title,
                }))
            }))
        });   
    } catch (error) {
        res.status(400).json("Error fetching user data");
    }
})



// ADD FAVORITE MEALS
router.post('/:userId/favMeals', async (req, res) =>{
    const mealId = req.body.mealId;
    const userId = req.params.userId;
    try {
        //FETCH USER CURRENT FAV MEALS
        const currentFavMeals = await database.select("favoritemeals").from('users').where('userid', '=', userId);
        const newFavMeals = [mealId].concat(currentFavMeals[0].favoritemeals);

        try {
            const favMeals = await database('users').update({favoritemeals:  newFavMeals}).where('userid', '=', userId);
            res.status(200).json('Fav Meal added')
        } catch (error) {
            console.log(error)
            res.status(400).json('Error saving new fav meal to db')
        }

    } catch (error) {
        res.status(400).json('Error fetching current fav meals');
    }
})




// REMOVE FAV MEALS
router.delete('/:userId/favMeals', async (req, res) =>{
    const mealId = req.body.mealId;
    const userId = req.params.userId;
    try {
        //FETCH USER CURRENT FAV MEALS
        const currentFavMeals = await database.select("favoritemeals").from('users').where('userid', '=', userId);
        const newFavMeals = currentFavMeals[0].favoritemeals.filter(id => mealId != id);

        try {
            const favMeals = await database('users').update({favoritemeals:  newFavMeals}).where('userid', '=', userId);
            res.status(200).json('Fav Meal removed')

        } catch (error) {
            res.status(400).json('Error saving new fav meal to db')
        }

    } catch (error) {
        res.status(400).json('Error fetching current fav meals');
    }
})



// PLACE ORDER.
router.post('/:userId/orders', async (req, res) =>{
    const {items, totalAmount} = req.body;
    const {userId} = req.params;

    const userOrders = await database.select("orders").from('users').where('userid', '=', userId);
        // USE TRANSACTION TO POST ORDER TO ORDERS TABLE AND USERS TABLE
    try {
        database.transaction(async (trx) => {
            try {
                const orderId = await trx.insert({
                    items: JSON.stringify(items),
                    userid: userId,
                    status: 'pending',
                    ordered_date: new Date(),
                    amount: totalAmount, 
                }).into('orders').returning('id');


                const currentBonusProgress = await trx.select('bonusprogress').from('users').where('userid', '=', userId);
                const additionBonusProgress = totalAmount/10000;
                let newBonusProgress;
                newBonusProgress = parseFloat(currentBonusProgress[0].bonusprogress) + additionBonusProgress;
                if(parseFloat(currentBonusProgress[0].bonusprogress) >= 1){
                    newBonusProgress = 0
                }

                // YOU COLLECT PAYMENT HERE AND GRANT DISCOUNT IF CURRENTBONUSPROGRESS IS 1.
               
                const updatedUser = await trx.update({
                    orders: orderId.concat(userOrders[0].orders),
                    bonusprogress: (newBonusProgress > 1 ? 1 : newBonusProgress)
                }).into('users').where('userid', '=', userId).returning('*');
                
                res.json(updatedUser)

                return;              
            } catch (error) {
                trx.rollback();
                res.status(400).json('Error')
            }
        })    
    } catch (error) {
        res.status(400).json('Error')
    }
})


module.exports = router;