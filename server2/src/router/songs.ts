import { Prisma, PrismaClient } from "@prisma/client";
import { Router, Request, Response } from "express";


const router = Router();
const prisma = new PrismaClient();

router.route("/").get(async(req:any , res:any)=>{
    try{
    const {url} = req.params;
      const song = await prisma.song.findFirst({
        where:{url:url}
      })
      if(!song){
        return res.status(202);
      }
      res.status(200).json(song);
    }catch(e){
      res.status(400).json({e});
    }
})
router.route('/').put(async(req:any,res:any)=>{
  try {
      const {id,url} = req.body;
      const updatedSong = await prisma.downloadedSong.update({
          where: { url: url },
          data: { path: id }
      });
      res.status(200).json(updatedSong);
  } catch (error) {
    res.status(400).json({error:error});
  }
})

export const songRouter = router;
