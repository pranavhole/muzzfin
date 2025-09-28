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
      const isReady:boolean = true;
      const updatedSong = await prisma.downloadedSong.upsert({
          where: { url: url },
          update: { path: id , isReady:isReady },
          create:{
            url:url,
            path:id,
            isReady:isReady
          }
      });
      res.status(200).json(updatedSong);
  } catch (error) {
    res.status(400).json({error:error});
  }
})

export const songRouter = router;
